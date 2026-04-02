import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function AdminLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const user = await login(username, password);
            if (user.role === 'admin') {
                navigate('/admin');
            } else {
                setError('This login is for administrators only.');
            }
        } catch (err) {
            setError(err.response?.data?.detail || 'Login failed');
        }
    };

    return (
        <div className="auth-container">
            <div className="glass-card auth-card" style={{ borderColor: 'rgba(255, 50, 50, 0.4)' }}>
                <div className="auth-header">
                    <h1 style={{ color: '#ff6b6b' }}>Admin Portal</h1>
                    <p>Log in with your administrator credentials</p>
                </div>
                {error && <div className="error-msg">{error}</div>}
                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Admin Username</label>
                        <input
                            type="text"
                            className="form-control"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            className="form-control"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #ff6b6b, #c92a2a)' }}>Secure Login</button>
                </form>
                <div className="auth-footer text-center">
                    <Link to="/login" className="text-muted">Return to User Login</Link>
                </div>
            </div>
        </div>
    );
}
