import { useState, useEffect } from 'react';
import { getSummary, createSettlement } from '../api';

export default function SummaryTable({ groupId }) {
    const [summary, setSummary] = useState(null);

    const loadSummary = async () => {
        try {
            const res = await getSummary(groupId);
            setSummary(res.data);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        if (groupId) loadSummary();
    }, [groupId]);

    const handleSettle = async (debtorId) => {
        // Basic settlement: just a prompt to clear their net balance.
        // In a real app, you'd specify WHO they paid. Here we assume paying the group admin or a central pot.
        const amount = prompt("Enter amount to settle for this member:");
        if (!amount || parseFloat(amount) <= 0) return;

        // Pick the first creditor logic for simplicity, or hardcode creditor_id to current admin.
        const adminId = JSON.parse(localStorage.getItem('user'))?.id;

        try {
            await createSettlement(groupId, {
                debtor_id: debtorId,
                creditor_id: adminId,
                amount: parseFloat(amount),
                note: 'Manual settlement via Summary Panel'
            });
            loadSummary();
            alert('Settlement recorded');
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to record settlement');
        }
    };

    if (!summary) return <p>Loading summary...</p>;

    return (
        <div className="glass-card" style={{ marginTop: '20px' }}>
            <h3>Group Summary & Net Balances</h3>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', marginTop: '16px' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '12px 0' }}>Member</th>
                        <th>Total Owed</th>
                        <th>To Receive</th>
                        <th>Net Balance</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {summary.balances.map(b => (
                        <tr key={b.user_id}>
                            <td style={{ padding: '12px 0' }}>{b.username}</td>
                            <td className="text-danger">{b.total_owed.toFixed(2)}</td>
                            <td style={{ color: 'var(--secondary)' }}>{b.total_to_receive.toFixed(2)}</td>
                            <td style={{ fontWeight: 'bold', color: b.net_balance < 0 ? 'var(--danger)' : 'var(--secondary)' }}>
                                {b.net_balance.toFixed(2)}
                            </td>
                            <td>
                                {b.net_balance < 0 && (
                                    <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => handleSettle(b.user_id)}>
                                        Settle Debt
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
