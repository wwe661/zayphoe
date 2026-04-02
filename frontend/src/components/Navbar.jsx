import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const dashboardLink = () => {
        if (!user) return '/login';
        if (user.role === 'admin') return '/admin';
        return '/dashboard';
    };

    return (
        <nav className="navbar">
            <Link to={dashboardLink()} className="navbar-brand">
                <span className="brand-icon">🛒</span>
                <span>Zay Phoe</span>
            </Link>
            {user && (
                <div className="navbar-right">
                    <span className="nav-user">
                        {user.role && <span className={`role-badge role-badge--${user.role}`}>{user.role.replace('_', ' ')}</span>}
                        {user.username}
                    </span>
                    <button className="btn btn-ghost" onClick={handleLogout}>Logout</button>
                </div>
            )}
        </nav>
    );
}
