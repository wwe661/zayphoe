import { useState, useEffect } from 'react';
import { adminGetGroups, adminCreateGroup, adminDeleteGroup, adminGetUsers } from '../api';

export default function MainAdminDashboard() {
    const [groups, setGroups] = useState([]);
    const [users, setUsers] = useState([]);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDesc, setNewGroupDesc] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [gRes, uRes] = await Promise.all([adminGetGroups(), adminGetUsers()]);
            setGroups(gRes.data);
            setUsers(uRes.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        try {
            await adminCreateGroup({ name: newGroupName, description: newGroupDesc });
            setNewGroupName('');
            setNewGroupDesc('');
            loadData();
        } catch (err) {
            alert('Failed to create group');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this group?')) return;
        try {
            await adminDeleteGroup(id);
            loadData();
        } catch (err) {
            alert('Failed to delete group');
        }
    };

    return (
        <div className="container mt-4">
            <div className="flex gap-4" style={{ alignItems: 'flex-start' }}>

                {/* Left Column: Create Group */}
                <div className="glass-card" style={{ flex: 1, position: 'sticky', top: '100px' }}>
                    <h2>Create New Group</h2>
                    <form onSubmit={handleCreateGroup}>
                        <div className="form-group">
                            <label>Group Name</label>
                            <input
                                type="text"
                                className="form-control"
                                value={newGroupName}
                                onChange={e => setNewGroupName(e.target.value)}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Description</label>
                            <input
                                type="text"
                                className="form-control"
                                value={newGroupDesc}
                                onChange={e => setNewGroupDesc(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary w-100">Create Group</button>
                    </form>
                </div>

                {/* Right Column: List of Groups */}
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h2>Managed Groups</h2>
                    {groups.length === 0 && <p className="text-muted">No groups created yet.</p>}
                    {groups.map(g => (
                        <div key={g.id} className="glass-card flex items-center" style={{ justifyContent: 'space-between' }}>
                            <div>
                                <h3 style={{ margin: 0, marginBottom: '4px' }}>{g.name}</h3>
                                <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>{g.description}</p>
                            </div>
                            <button
                                className="btn btn-danger"
                                onClick={() => handleDelete(g.id)}
                            >
                                Delete
                            </button>
                        </div>
                    ))}

                    <h2 style={{ marginTop: '24px' }}>System Users</h2>
                    <div className="glass-card">
                        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '8px 0' }}>Username</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td style={{ padding: '8px 0' }}>{u.username}</td>
                                        <td>{u.email}</td>
                                        <td><span className={`role-badge role-badge--${u.role}`}>{u.role.replace('_', ' ')}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                </div>

            </div>
        </div>
    );
}
