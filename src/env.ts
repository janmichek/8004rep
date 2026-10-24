import { ref } from 'vue'

export type NetworkEnv = 'mainnet' | 'testnet'

const KEY = '8004rep:env'

function stored(): NetworkEnv {
  try {
    return localStorage.getItem(KEY) === 'testnet' ? 'testnet' : 'mainnet'
  } catch {
    return 'mainnet'
  }
}

/** The whole-app switch in the classic header. */
export const networkEnv = ref<NetworkEnv>(stored())

export function setNetworkEnv(value: NetworkEnv): void {
  networkEnv.value = value
  try {
    localStorage.setItem(KEY, value)
  } catch {
    // Private mode: the switch still holds for this session.
  }
}
