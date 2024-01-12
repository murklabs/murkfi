.PHONY: test

test-local:
	solana-test-validator > /dev/null 2>&1 & echo $$! > /tmp/solana-test-validator.pid
	sleep 5
	anchor run test1
	kill `cat /tmp/solana-test-validator.pid` && rm /tmp/solana-test-validator.pid

test-devnet:
	anchor test --provider.cluster devnet