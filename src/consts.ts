import {getServerPort} from './debug';

const SERVER_BASE = `http://192.168.50.132:${getServerPort()}`;
// const SERVER_BASE = 'http://localhost:8081';
export const SOCKET_BASE = SERVER_BASE;
export const API_BASE = `${SERVER_BASE}/api`;