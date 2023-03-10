import {getServerPort} from './debug';

// const SERVER_BASE = ;
// const SERVER_BASE = `http://192.168.50.132:${getServerPort()}`;
const isProd = process.env.NODE_ENV === 'production';
const SERVER_BASE = isProd ? 'https://api.swordswithfriends.org:443' : `http://localhost:${getServerPort()}`;
export const SOCKET_BASE = SERVER_BASE;
export const API_BASE = `${SERVER_BASE}/api`;
