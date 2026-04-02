import api from './client';

// --- Auth ---
export const register = (data) => api.post('/auth/register', data);
export const login = (data) => api.post('/auth/login', data);

// --- Admin ---
export const adminGetGroups = () => api.get('/admin/groups');
export const adminGetUsers = () => api.get('/admin/users');
export const adminCreateGroup = (data) => api.post('/admin/groups', data);
export const adminUpdateGroup = (id, data) => api.put(`/admin/groups/${id}`, data);
export const adminDeleteGroup = (id) => api.delete(`/admin/groups/${id}`);

// --- Groups / Members ---
export const getMembers = (gid) => api.get(`/groups/${gid}/members`);
export const addMember = (gid, data) => api.post(`/groups/${gid}/members`, data);
export const removeMember = (gid, uid) => api.delete(`/groups/${gid}/members/${uid}`);
export const getEligibleFriends = (gid) => api.get(`/groups/${gid}/eligible-friends`);

// --- Expenses ---
export const getExpenses = (gid) => api.get(`/groups/${gid}/expenses`);
export const createExpense = (gid, data) => api.post(`/groups/${gid}/expenses`, data);
export const deleteExpense = (gid, eid) => api.delete(`/groups/${gid}/expenses/${eid}`);

// --- Manual Debits (Deposits) ---
export const getDebits = (gid) => api.get(`/groups/${gid}/debits`);
export const createDebits = (gid, data) => api.post(`/groups/${gid}/debits`, data);
export const deleteDebit = (gid, did) => api.delete(`/groups/${gid}/debits/${did}`);

// --- Summary / Reset ---
export const getSummary = (gid) => api.get(`/groups/${gid}/summary`);
export const resetGroup = (gid) => api.post(`/groups/${gid}/reset`);

// --- Settlements ---
export const getSettlements = (gid) => api.get(`/groups/${gid}/settlements`);
export const createSettlement = (gid, data) => api.post(`/groups/${gid}/settlements`, data);

// --- User / Me ---
export const getMe = () => api.get('/users/me');
export const getMyGroups = () => api.get('/users/me/groups');
export const getMyBalance = () => api.get('/users/me/balance');
export const getAllUsers = () => api.get('/users');

// --- Friends ---
export const sendFriendRequest = (data) => api.post('/friends/request', data);
export const acceptFriendRequest = (fid) => api.post(`/friends/${fid}/accept`);
export const getFriendships = () => api.get('/friends');

// --- Group Creation (User Level) ---
export const createGroup = (data) => api.post('/groups', data);
export const getGroup = (gid) => api.get(`/groups/${gid}`);
export const deleteGroup = (gid) => api.delete(`/groups/${gid}`);
