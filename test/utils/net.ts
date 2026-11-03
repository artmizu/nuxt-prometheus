import type { AddressInfo } from 'node:net'

export function portOf(server: { address: () => AddressInfo | string | null }) {
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('the test server did not bind a TCP port')
  return address.port
}
