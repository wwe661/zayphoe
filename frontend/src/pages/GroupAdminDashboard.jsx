import { useState, useEffect } from 'react';
import { adminGetGroups, getExpenses } from '../api';
import MemberList from '../components/MemberList';
import ExpenseForm from '../components/ExpenseForm';
import ManualDebitForm from '../components/ManualDebitForm';
import SummaryTable from '../components/SummaryTable';

export default function GroupAdminDashboard() {
    const [groups, setGroups] = useState([]);
    const [selectedGroupId, setSelectedGroupId] = useState('');
    const [expenses, setExpenses] = useState([]);

    useEffect(() => {
        loadGroups();
    }, []);

    const loadGroups = async () => {
        try {
            // Group admin needs to see all groups they manage (we'll fetch all groups where they have access)
            // Using adminGetGroups for simplicity, assuming API dependency requires group_admin
            // In production, an endpoint like `/users/me/managed-groups` would be safer
            const res = await adminGetGroups();
            setGroups(res.data);
            if (res.data.length > 0) setSelectedGroupId(res.data[0].id);
        } catch (err) { console.error(err); }
    };

    const loadExpenses = async () => {
        if (!selectedGroupId) return;
        try {
            const res = await getExpenses(selectedGroupId);
            setExpenses(res.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        if (selectedGroupId) {
            loadExpenses();
        }
    }, [selectedGroupId]);

    if (groups.length === 0) return <div className="container mt-4"><p>No groups available to manage.</p></div>;

    return (
        <div className="container mt-4">
            <div className="flex items-center gap-4 mb-4">
                <h2>Manage Group:</h2>
                <select
                    className="form-control"
                    style={{ width: '300px' }}
                    value={selectedGroupId}
                    onChange={e => setSelectedGroupId(e.target.value)}
                >
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
            </div>

            <div className="flex gap-4">
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <MemberList groupId={selectedGroupId} />

                    <div className="glass-card">
                        <h3>Recent Expenses</h3>
                        {expenses.length === 0 && <p className="text-muted">No expenses yet.</p>}
                        {expenses.map(ex => (
                            <div key={ex.id} style={{ borderBottom: '1px solid var(--border)', padding: '12px 0' }}>
                                <div className="flex" style={{ justifyContent: 'space-between' }}>
                                    <strong>{ex.description}</strong>
                                    <span>${ex.amount.toFixed(2)}</span>
                                </div>
                                <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                                    Paid by: {ex.paid_by_user?.username} • Split: {ex.split_mode}
                                </div>
                            </div>
                        ))}
                    </div>

                </div>

                <div style={{ flex: 2 }}>
                    {/* We pass an empty members array down to ExpenseForm for now, 
              but it should really fetch members to pass down. We'll let MemberList handle members 
              or we can fetch them here. Let's fetch members here for the forms.
          */}
                    <GroupAdminForms groupId={selectedGroupId} onDataChanged={loadExpenses} />
                    <SummaryTable groupId={selectedGroupId} />
                </div>
            </div>
        </div>
    );
}

// Helper component to handle member state for forms
import { getMembers } from '../api';
function GroupAdminForms({ groupId, onDataChanged }) {
    const [members, setMembers] = useState([]);

    useEffect(() => {
        if (groupId) {
            getMembers(groupId).then(res => setMembers(res.data)).catch(console.error);
        }
    }, [groupId]);

    return (
        <>
            <ExpenseForm groupId={groupId} members={members} onExpenseAdded={onDataChanged} />
            <ManualDebitForm groupId={groupId} members={members} onDebitAdded={onDataChanged} />
        </>
    );
}
