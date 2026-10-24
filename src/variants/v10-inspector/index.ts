import './style.css'
import Agents from './Agents.vue'
import Network from './Network.vue'
import Owner from './Owner.vue'
import Shell from './Shell.vue'

// One component per view: the agent and reviewer routes are selections inside it.
export { Shell }
export const pages = { agents: Agents, agent: Agents, network: Network, owner: Owner, reviewer: Network }
