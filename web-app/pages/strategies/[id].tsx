import { useRouter } from "next/router"

export default function Vault0Page() {
  const router = useRouter()
  const { id } = router.query
  return <div>Vault {id}</div>
}
