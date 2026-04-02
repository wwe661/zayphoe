import { useState } from 'react';
import { createExpense } from '../api';

export default function ExpenseForm({ groupId, members, onExpenseAdded }) {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [paidBy, setPaidBy] = useState('');
    const [splitMode, setSplitMode] = useState('equal');
    const [customShares, setCustomShares] = useState({});

    const handleCustomShareChange = (userId, val) => {
        setCustomShares(prev => ({ ...prev, [userId]: parseFloat(val) || 0 }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!paidBy) return alert('Select payer');

        const payload = {
            paid_by: parseInt(paidBy),
            amount: parseFloat(amount),
            description,
            split_mode: splitMode,
        };

        if (splitMode === 'custom') {
            const sharesList = Object.keys(customShares).map(uid => ({
                debtor_id: parseInt(uid),
                share_amount: customShares[uid]
            })).filter(s => s.debtor_id !== parseInt(paidBy)); // Exclude payer from debtors

            const totalShares = sharesList.reduce((acc, s) => acc + s.share_amount, 0);
            if (Math.abs(totalShares - parseFloat(amount)) > 0.01) {
                return alert(`Custom shares (${totalShares}) must equal total amount (${amount})`);
            }
            payload.custom_shares = sharesList;
        }

        try {
            await createExpense(groupId, payload);
            setAmount('');
            setDescription('');
            setSplitMode('equal');
            setCustomShares({});
            if (onExpenseAdded) onExpenseAdded();
            alert('Expense recorded successfully');
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to record expense');
        }
    };

    return (
        <div className="glass-card">
            <h3>Record Expense</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Payer</label>
                    <select className="form-control" value={paidBy} onChange={e => setPaidBy(e.target.value)} required>
                        <option value="">Select Payer...</option>
                        {members.map(m => <option key={m.user_id} value={m.user_id}>{m.user.username}</option>)}
                    </select>
                </div>
                <div className="flex gap-4">
                    <div className="form-group" style={{ flex: 1 }}>
                        <label>Amount</label>
                        <input type="number" step="0.01" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ flex: 2 }}>
                        <label>Description</label>
                        <input type="text" className="form-control" value={description} onChange={e => setDescription(e.target.value)} required />
                    </div>
                </div>

                <div className="form-group">
                    <label>Split Mode</label>
                    <div className="flex gap-4" style={{ marginBottom: '16px' }}>
                        <label className="flex items-center gap-2">
                            <input type="radio" name="split" checked={splitMode === 'equal'} onChange={() => setSplitMode('equal')} /> Equal Split
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="radio" name="split" checked={splitMode === 'custom'} onChange={() => setSplitMode('custom')} /> Custom Split
                        </label>
                    </div>
                </div>

                {splitMode === 'custom' && paidBy && (
                    <div className="glass-card" style={{ background: 'rgba(0,0,0,0.2)', marginBottom: '20px', padding: '16px' }}>
                        <h4 style={{ margin: '0 0 12px 0' }}>Assign specific amounts:</h4>
                        {members.filter(m => m.user_id !== parseInt(paidBy)).map(m => (
                            <div key={m.user_id} className="flex items-center gap-2 mb-2">
                                <span style={{ width: '120px' }}>{m.user.username} owes:</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="form-control"
                                    style={{ width: '150px', padding: '8px' }}
                                    onChange={e => handleCustomShareChange(m.user_id, e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                        ))}
                    </div>
                )}

                <button type="submit" className="btn btn-primary w-100">Add Expense</button>
            </form>
        </div>
    );
}
