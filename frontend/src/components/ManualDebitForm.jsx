import { useState } from 'react';
import { createDebits } from '../api';

export default function ManualDebitForm({ groupId, members, onDebitAdded }) {
    const [selectedDebtors, setSelectedDebtors] = useState([]);
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');

    const handleToggleDebtor = (uid) => {
        setSelectedDebtors(prev =>
            prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (selectedDebtors.length === 0) return alert('Select at least one member');
        if (!amount || parseFloat(amount) <= 0) return alert('Enter a valid amount');

        const entries = selectedDebtors.map(uid => ({
            debtor_id: parseInt(uid),
            amount: parseFloat(amount)
        }));

        try {
            await createDebits(groupId, { entries, reason });
            setAmount('');
            setReason('');
            setSelectedDebtors([]);
            if (onDebitAdded) onDebitAdded();
            alert('Manual debits recorded');
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to record debits');
        }
    };

    return (
        <div className="glass-card" style={{ marginTop: '20px' }}>
            <h3>Manual Debit (Charge Members)</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '16px' }}>
                Charge specific members directly (e.g., late fees, personal loans).
            </p>

            <form onSubmit={handleSubmit}>
                <div className="form-group mb-4">
                    <label>Select Members to Charge</label>
                    <div className="flex" style={{ flexWrap: 'wrap', gap: '12px' }}>
                        {members.map(m => (
                            <label key={m.user_id} className="flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.05)', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={selectedDebtors.includes(m.user_id)}
                                    onChange={() => handleToggleDebtor(m.user_id)}
                                />
                                {m.user.username}
                            </label>
                        ))}
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="form-group" style={{ flex: 1 }}>
                        <label>Amount (per member)</label>
                        <input type="number" step="0.01" className="form-control" value={amount} onChange={e => setAmount(e.target.value)} required />
                    </div>
                    <div className="form-group" style={{ flex: 2 }}>
                        <label>Reason</label>
                        <input type="text" className="form-control" value={reason} onChange={e => setReason(e.target.value)} required />
                    </div>
                </div>

                <button type="submit" className="btn btn-secondary w-100">Record Debits</button>
            </form>
        </div>
    );
}
