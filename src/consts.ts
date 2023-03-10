import {getServerPort} from './debug';

// const SERVER_BASE = ;
// const SERVER_BASE = `http://192.168.50.132:${getServerPort()}`;
const SERVER_BASE =
  process.env.NODE_ENV === 'production' ? 'https://api.swordswithfriends.org:443' : `http://localhost:${getServerPort()}`;
export const SOCKET_BASE = SERVER_BASE;
export const API_BASE = `${SERVER_BASE}/api`;
