import argparse
import asyncio
import logging
import os
import time
from datetime import datetime, timedelta
from typing import List
import traceback

from solders.keypair import Keypair

import anchorpy
from solana.exceptions import SolanaRpcException
from solana.rpc.commitment import Commitment, Confirmed
from solana.rpc.websocket_api import connect
from solana.rpc.types import TxOpts
import httpx

from zetamarkets_py import utils
from zetamarkets_py.client import Client
from zetamarkets_py.types import Asset, Network, Order, OrderArgs, OrderOptions, OrderType, Side
from zetamarkets_py.orderbook import Orderbook
from zetamarkets_py.serum_client.accounts.orderbook import OrderbookAccount

import pandas as pd

from zetamarkets_py.events import TradeEvent

# Initialize logging (optional)
logging.basicConfig(level=logging.INFO)


class MarketMaker:
    def __init__(self, client: Client, asset: Asset, size: float, edge: float, offset: float,
                 current_open_orders: List[Order]):
        self.client = client
        self.asset = asset
        self._is_quoting = False
        self.fair_price = None

        # Configuration parameters
        self.edge_bps = edge
        self.offset_bps = offset
        self.quote_size = size

        self.EDGE_REQUOTE_THRESHOLD = 0.25
        self.TIF_DURATION = 120

        self._ratelimit_until_ts = 0
        self.ws_endpoint = os.getenv("WS_ENDPOINT", "wss://api.mainnet-beta.solana.com")

        # Get the best bid and ask from open orders
        self.bid_price_from_ob = 0
        self.ask_price_from_ob = 0
        self.bid_price = 0
        self.ask_price = 0
        self.fair_price = 0
        self.limit_bid_price = 0
        self.limit_ask_price = 0

        # Feature flags
        self.is_update_quotes_enabled = True

    @classmethod
    async def load(cls, endpoint: str, wallet: anchorpy.Wallet, asset: Asset, size=0.001, edge=20, offset=0,
                   network=Network.MAINNET, commitment=Confirmed):
        tx_opts = TxOpts(skip_preflight=False, skip_confirmation=False, preflight_commitment=commitment)
        client = await Client.load(endpoint=endpoint, commitment=commitment, wallet=wallet, assets=[asset],
                                   tx_opts=tx_opts, network=network, log_level=logging.INFO)
        open_orders = await client.fetch_open_orders(asset)
        return cls(client, asset, size, edge, offset, open_orders)

    async def subscribe_orderbook_midpoint_ws(self):
        """
        Subscribe to the orderbook midpoint over a websocket connection
        :return:
        """
        bids_address = self.client.exchange.markets[self.asset]._market_state.bids
        asks_address = self.client.exchange.markets[self.asset]._market_state.asks

        async with connect(self.ws_endpoint) as ws:
            # Subscribe to the first address
            bids_subscription_future = asyncio.ensure_future(
                ws.account_subscribe(
                    bids_address,
                    commitment=Confirmed,
                    encoding="base64+zstd",
                )
            )

            # Subscribe to the second address
            asks_subscription_future = asyncio.ensure_future(
                ws.account_subscribe(
                    asks_address,
                    commitment=Confirmed,
                    encoding="base64+zstd",
                )
            )

            # Wait for both subscriptions to be completed before proceeding
            await asyncio.gather(bids_subscription_future, asks_subscription_future)

            # Collect subscription IDs
            subscription_ids = []
            while len(subscription_ids) < 2:
                result = (await ws.recv())[0].result
                # Filter for just the initial subscription id message
                if isinstance(result, int):
                    subscription_ids.append(result)

            # Assign subscription IDs to bids and asks
            bids_subscription_id, asks_subscription_id = subscription_ids

            # Listen for messages related to both subscriptions
            async for msg in ws:
                # Decode the bytes received over the websocket based on the account data layout
                # Bids and asks have the same layout, so we can use the same decoder
                account = OrderbookAccount.decode(msg[0].result.value.data)
                # Process the account dataDetermine side based on subscription_id
                side = None
                incoming_subscription_id = msg[0].subscription
                if incoming_subscription_id == bids_subscription_id:
                    side = Side.Bid
                elif incoming_subscription_id == asks_subscription_id:
                    side = Side.Ask

                if side is None:
                    print(f"Unknown incoming_subscription_id={incoming_subscription_id}, skipping")
                    continue

                orderbook = Orderbook(side, account, self.client.exchange.markets[self.asset]._market_state)
                level = orderbook._get_l2(1)[0]
                if side == Side.Bid:
                    self.bid_price_from_ob = level.price
                else:
                    self.ask_price_from_ob = level.price

                self.fair_price = (self.bid_price_from_ob + self.ask_price_from_ob) / 2

                try:
                    asyncio.create_task(self.update_quotes())
                except Exception as e:
                    print(f"Failed to set initial quotes: {e}")

    # async def subscribe_orderbook_midpoint(self):
    #     """
    #     Subscribe to the orderbook and update the midpoint on every update
    #     :return:
    #     """
    #     bid_task = asyncio.create_task(self.monitor_orderbook(self.asset, Side.Bid))
    #     ask_task = asyncio.create_task(self.monitor_orderbook(self.asset, Side.Ask))
    #     await asyncio.gather(bid_task, ask_task)
    #
    # async def monitor_orderbook(self, asset, side):
    #     print('Monitoring orderbook...')
    #     async for orderbook, _ in self.client.subscribe_orderbook(asset, side):
    #
    #         level = orderbook._get_l2(1)[0]
    #         if side == Side.Bid:
    #             self.bid_price_from_ob = level.price
    #         else:
    #             self.ask_price_from_ob = level.price
    #
    #         self.fair_price = (self.bid_price_from_ob + self.ask_price_from_ob) / 2
    #         # print(f"Highest Bid: {self.bid_price}, Lowest Ask: {self.ask_price}, Midpoint: {self.fair_price}")
    #         try:
    #             asyncio.create_task(self.update_quotes())
    #         except Exception as e:
    #             print(f"Failed to set initial quotes: {e}")

    # TODO:
    # 1) Log open positions and open orders
    # 2) Wait for a few seconds after placing orders to update quotes
    async def update_quotes(self):

        """
        Update limit order quotes based on the current orderbook
        :return:
        """
        if self._is_quoting:
            return

        if time.time() < self._ratelimit_until_ts:
            print(f"Rate limited by RPC. Retrying in {self._ratelimit_until_ts - time.time():.1f} seconds")
            return

        if self.fair_price is None:
            print("No fair price yet")
            return

        # Fetch current inventory
        balance, positions = await self.client.fetch_margin_state()
        open_orders = await self.client.fetch_open_orders(self.asset)
        summary = await self.client.get_account_risk_summary()

        # Fetch current open orders
        sol_position = positions.get(self.asset, None)

        # Calculate new limit order prices based on the fair price
        self.limit_bid_price = self.fair_price * (1 - self.edge_bps / 10000)
        self.limit_ask_price = self.fair_price * (1 + self.edge_bps / 10000)

        # Calculate deviations checks for updating quotes
        bid_deviation = abs(
            self.limit_bid_price - self.bid_price)  # TODO: Difference between limit orders we WANT To place vs current bid/ask prices
        ask_deviation = abs(self.limit_ask_price - self.ask_price)
        bid_deviation_threshold = self.edge_bps / 10000 * self.bid_price
        ask_deviation_threshold = self.edge_bps / 10000 * self.ask_price
        bid_deviation_check = bid_deviation > bid_deviation_threshold
        ask_deviation_check = ask_deviation > ask_deviation_threshold

        print('--' * 20)
        print("Limit Order Prices")
        print('limit_bid_price: ', self.limit_bid_price)
        print('Current bid price: ', self.bid_price)
        print('Current fair price: ', self.fair_price)
        print('Current ask price: ', self.ask_price)
        print('limit_ask_price: ', self.limit_ask_price)
        print('--' * 20)
        print('Bid and ask price deltas')
        print('Bid delta: ', abs(self.bid_price - self.fair_price))
        print('Ask delta: ', abs(self.ask_price - self.fair_price))
        print('--' * 20)
        print('Deviation Checks')
        print(f"Bid deviation check: {bid_deviation} vs {bid_deviation_threshold}")
        print(f"Ask deviation check: {ask_deviation} vs {ask_deviation_threshold}")
        print('--' * 20)

        if self.is_update_quotes_enabled is False:
            print("update_quotes functionality is disabled, skipping")
            return

        # Check if we have open orders
        # if no open orders or only 1 order open (long/short), place new orders at limit prices
        # This is done to always have 2 orders open
        if not open_orders or len(open_orders) == 1:
            print("No open orders or missing one order. Placing new orders at limit prices.")
            self.bid_price = self.limit_bid_price
            self.ask_price = self.limit_ask_price
            print("Current bid and ask prices: ", self.bid_price, self.ask_price)
            await self.trigger_order_update()  # Fails

        # Check if we have a position open
        if sol_position and abs(sol_position.size) > 0:
            print('We have a position. Checking if position is profitable...')

            # Compute avg cost basis for position and determine profitability based on previously computer fair mkt price
            avg_cost_basis = sol_position.cost_of_trades / abs(sol_position.size)
            is_position_profitable = (self.fair_price > avg_cost_basis) if sol_position.size > 0 else (
                    self.fair_price < avg_cost_basis)

            # If the positions is profitable, calculate profit factor and adjust limit orders
            if is_position_profitable:
                # Calculating profit factor
                print("Position is profitable. Adjusting limit orders based on profit factor")
                # The profit_factor is the % difference between the fair price and the avg cost basis
                profit_factor = (self.fair_price - avg_cost_basis) / avg_cost_basis if sol_position.size > 0 else (
                                                                                                                          avg_cost_basis - self.fair_price) / avg_cost_basis  # noqa
                # TODO: Redundant check since we know the position is profitable, move profit_factor to be what the if statement is driven off of
                profit_factor = max(0, profit_factor)
                print(f'Position profit factor: {round(profit_factor, 5) * 100}%')

                # Check if price has deviated from fair price by edge_bps
                # This is done to avoid adjusting limit orders every time the OB changes
                if bid_deviation_check or ask_deviation_check:
                    print(
                        "Price deviation is greater than threshold. Adjusting limit orders based on profit factor")
                    if sol_position.size > 0:  # Long position
                        print("Long position. Adjusting ask price based on profit factor")
                        self.limit_ask_price *= (1 - profit_factor * self.edge_bps / 10000)
                        self.ask_price = self.limit_ask_price
                    else:  # Short position
                        print("Short position. Adjusting bid price based on profit factor")
                        self.limit_bid_price *= (1 + profit_factor * self.edge_bps / 10000)
                        self.bid_price = self.limit_bid_price
                    print("Current bid and ask prices: ", self.bid_price, self.ask_price)
                    await self.trigger_order_update()
                else:
                    print("Fair price is within threshold. No need to update quotes")
                    return
            # If the position is not profitable, adjust limit orders based on market deviation
            else:
                print("Position is not profitable. Adjusting limit orders based on market deviation")
                if bid_deviation_check or ask_deviation_check:
                    print('Price deviation is greater than threshold. Updating quotes')
                    self.bid_price = self.limit_bid_price
                    self.ask_price = self.limit_ask_price
                    print("Current bid and ask prices: ", self.bid_price, self.ask_price)
                    await self.trigger_order_update()
                print("Fair price is within threshold. No need to update quotes")
                return
        # If we have open orders but no position, adjust limit orders based on market deviation
        else:
            print("We have open orders but no position. Adjusting limit orders based on market deviation")
            if abs(self.limit_bid_price - self.bid_price) > (self.edge_bps / 10000 * self.bid_price) or abs(
                    self.limit_ask_price - self.ask_price) > (self.edge_bps / 10000 * self.ask_price):
                print('Price deviation is greater than threshold. Updating quotes')
                self.bid_price = self.limit_bid_price
                self.ask_price = self.limit_ask_price
                print("Current bid and ask prices: ", self.bid_price, self.ask_price)
                await self.trigger_order_update()
            print("Fair price is within threshold. No need to update quotes")
            return

    async def trigger_order_update(self):
        """
        Trigger an order update
        :return:
        """
        # Set order options
        expiry_ts = int((datetime.now() + timedelta(
            seconds=self.TIF_DURATION)).timestamp()) if self.client.network == Network.MAINNET else None
        order_opts = OrderOptions(expiry_ts=expiry_ts, order_type=OrderType.PostOnlySlide, client_order_id=1337)
        bid_order = OrderArgs(self.bid_price, self.quote_size, Side.Bid, order_opts)
        ask_order = OrderArgs(self.ask_price, self.quote_size, Side.Ask, order_opts)

        self._is_quoting = True
        try:
            print("Placing new orders...")
            print('---------------------')
            print(f"Quoting {self.asset}: ${self.bid_price:.4f}@ ${self.ask_price:.4f} x {self.quote_size}")
            await self.client.replace_orders_for_market(self.asset, [bid_order, ask_order])
            print("Orders placed successfully")
            print('---------------------')
        except SolanaRpcException as e:
            original_exception = e.__cause__
            if (
                    isinstance(original_exception, httpx.HTTPStatusError)
                    and original_exception.response.status_code == 429  # HTTP status code for Too Many Requests
            ):
                retry_after = int(original_exception.response.headers.get("Retry-After", 10))
                print(f"Rate limited. Retrying after {retry_after} seconds...")
                self._ratelimit_until_ts = time.time() + retry_after  # Retry after x seconds
            else:
                print(f"An RPC error occurred: {e}")
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
        finally:
            self._is_quoting = False

    async def write_to_csv(self):
        csv_file_path = "account_summary.csv"
        while True:
            await asyncio.sleep(600)  # Wait for 10 minutes
            try:
                summary = await self.client.get_account_risk_summary()
                balance = summary.balance
                upnl = summary.unrealized_pnl
                total_balance = balance + upnl
                current_time = datetime.now()

                # Create a DataFrame for the new data
                data = {
                    "Timestamp": [current_time],
                    "Balance": [balance],
                    "Unrealized PnL": [upnl],
                    "Total Balance": [total_balance]
                }
                df = pd.DataFrame(data)

                # Check if the file exists to determine if headers should be written
                if not os.path.isfile(csv_file_path):
                    df.to_csv(csv_file_path, mode='w', index=False)  # Write with headers
                else:
                    df.to_csv(csv_file_path, mode='a', header=False, index=False)  # Append without headers

            except Exception as e:
                print(f"Error while writing to CSV: {e}")

    async def run(self):
        try:
            tasks = [
                asyncio.create_task(self.subscribe_orderbook_midpoint_ws()),
                asyncio.create_task(self.write_to_csv()),
            ]
            # Initialize quotes
            while True:
                await asyncio.sleep(1)  # Check every second
                for task in tasks:
                    if task.done() and task.exception() is not None:
                        e = task.exception()
                        print(f"An error occurred in a task: {e}")
                        traceback.print_exception(type(e), e, e.__traceback__)
        except KeyboardInterrupt:
            print("Exiting...")
        finally:
            # Cancel all orders on exit
            for task in tasks:
                task.cancel()
            await self.client.cancel_orders_for_market(self.asset)


async def main():
    parser = argparse.ArgumentParser(description="Zeta Market Maker")

    parser.add_argument(
        "-n",
        "--network",
        type=Network,
        choices=list(Network),
        default=Network.MAINNET,
        help="The network to use. Defaults to %(default)s.",
    )

    parser.add_argument(
        "-u",
        "--url",
        type=str,
        help="The endpoint URL (optional).",
    )

    parser.add_argument(
        "-c",
        "--commitment",
        type=Commitment,
        default=Confirmed,
        help="The commitment level. Defaults to %(default)s.",
    )

    parser.add_argument(
        "-a",
        "--asset",
        type=Asset,
        choices=list(Asset),
        default=Asset.SOL,
        help="The asset identifier. Defaults to %(default)s.",
    )

    parser.add_argument(
        "-s",
        "--size",
        type=float,
        # default=MIN_LOT_SIZE, # change to use the minimum lot size constant
        default=0.1,
        help="The quote edge in bps. Defaults to %(default)s lots.",
    )

    parser.add_argument(
        "-e",
        "--edge",
        type=float,
        help="The quote edge in bps. Defaults to %(default)s bps.",
    )

    parser.add_argument(
        "-o",
        "--offset",
        type=float,
        default=0,
        help="The quote offset in bps. Defaults to %(default)s bps.",
    )

    args = parser.parse_args()

    # If endpoint is not specified, get it from the network argument
    endpoint = args.url if args.url else utils.cluster_endpoint(args.network)

    args = parser.parse_args()

    endpoint = args.url if args.url else utils.cluster_endpoint(args.network)

    # Load your wallet
    KEYPAIR_PATH = "makerkey.json"
    # KEYPAIR_PATH = "murk_protocol.json"
    with open(KEYPAIR_PATH) as kp_file:
        kp = Keypair.from_json(kp_file.read())
    wallet = anchorpy.Wallet(kp)

    # Initialize and run the market maker
    market_maker = await MarketMaker.load(endpoint, wallet, args.asset, args.size,
                                          args.edge, args.offset, args.network, args.commitment)
    await market_maker.run()


asyncio.run(main())