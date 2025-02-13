import { faAngleDown, faArrowRight, faCircle, faUser } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../utils/AuthContext';
import api from '../../utils/axiosConfig';
import CartModal from '../CartModal';
import '../css/Navbar.css';
import CartItemCount from './CartItemCount';

const Navbar = () => {
    const { currentUser, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const dropdownRef = useRef(null);
    const [profilePicURL, setProfilePicURL] = useState('/Assets/profile-picture.jpg');
    const [dropdownActive, setDropdownActive] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [userAccountType, setUserAccountType] = useState('');

    useEffect(() => {
        if (currentUser) {
            const fetchUserAccountType = async () => {
                try {
                    const response = await api.get(`/users/${currentUser.id}/accountType`);
                    setUserAccountType(response.data); 
                } catch (error) {
                    console.error('Error fetching user account type:', error);
                }
            };
        
            fetchUserAccountType();
        }
        
    }, [currentUser]);

    const closeShowModal = () => {
        setShowModal(false);
    };

    const toggleDropdown = () => {
        setDropdownActive(!dropdownActive);
    };

    const closeDropdown = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
            setDropdownActive(false);
        }
    };

    useEffect(() => {
        if (currentUser?.image) {
            setProfilePicURL(currentUser.image);
        }
    }, [currentUser]);

    useEffect(() => {
        document.addEventListener('mousedown', closeDropdown);
        return () => {
            document.removeEventListener('mousedown', closeDropdown);
        };
    }, []);

    const getPageLink = () => {
        if(!currentUser) return '/login';
        switch (currentUser.accountType) {
        case 'admin':
            return '/admin-analytics';
        case 'shop':
            return '/shop-dashboard';
        case 'regular':
            return '/home';
        case 'dasher':
            return '/dasher-orders';
        default:
            return '/home';
    }
    }

        // Check if the current path is /login or /signup
        const hideNavbar = location.pathname === '/login' || location.pathname === '/signup';

        return (
            !hideNavbar && (  // Conditionally render the navbar based on the hideNavbar variable
                <div>
                    <div className="nav-top">
                        <Link to={getPageLink()} style={{ textDecoration: 'none' }}>
                            <div className='nav-logo'>
                                <span className="campus">Campus</span>
                                <span className="eats">Eats</span>
                                <span className="campus-text">Cebu Institute of Technology - University</span>
                            </div>
                        </Link>
    
                        <div className='right-nav'>
                            {currentUser ? (
                                <>
                                    <div className='nb-profile-dropdown' ref={dropdownRef}>
                                        <div className='nb-profile-dropdown-btn' onClick={toggleDropdown}>
                                            <div className='nb-profile-img'>
                                                <img src={profilePicURL} alt="Profile" className="nb-profile-img" />
                                                <FontAwesomeIcon icon={faCircle} style={{ position: 'absolute', bottom: '0.2rem', right: '0', fontSize: '0.7rem', color: '#37be6b' }} />
                                            </div>
                                            <span>
                                                {currentUser.username}
                                                <FontAwesomeIcon icon={faAngleDown} style={{ padding: '2px 0 0 4px', fontSize: '1rem', color: '#d2627e' }} />
                                            </span>
                                        </div>
                                        <ul className={`nb-profile-dropdown-list ${dropdownActive ? 'active' : ''}`}>
                                            <li className="nb-profile-dropdown-list-item">
                                                <Link to="/profile">
                                                    <div className='nb-profile-dropdown-list-item-icon'>
                                                        <FontAwesomeIcon icon={faUser} style={{ fontSize: '1rem', color: 'white' }} />
                                                    </div>
                                                    Edit Profile
                                                </Link>
                                            </li>
                                            <li className="nb-profile-dropdown-list-item">
                                                <a href="#" onClick={logout}>
                                                    <div className='nb-profile-dropdown-list-item-icon'>
                                                        <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: '1rem', color: 'white' }} />
                                                    </div>
                                                    Log out
                                                </a>
                                            </li>
                                        </ul>
                                    </div>
                                    {userAccountType === 'regular' && (
                                        <CartItemCount 
                                            showModal={showModal} 
                                            setShowModal={setShowModal}
                                        />
                                    )}

                                    </>
                            ) : (
                                <div className="navbar-buttons">
                                    <button onClick={() => { window.location.href = '/signup'; }} className="signup-button">Sign up</button>
                                    <button onClick={() => { window.location.href = '/login'; }} className="login-button">Login</button>
                                </div>
                            )}
                        </div>
                    </div>
    
                    {/* Render navigation links based on user account type */}
                    {currentUser && userAccountType === 'regular' && (
                        <div className="nav-side">
                            <div className="image-wrapper">
                                <Link to="/home" style={{ textDecoration: 'none' }}>
                                    <div className="svg-container" style={{ width: '50px', height: '50px' }}>
                                        <img src={'/Assets/logo.svg'} alt="Logo" className="nb-logo" />
                                    </div>
                                </Link>
                            </div>
                            <div className='nav'>
                                <ul>
                                    <li className={`nb-icon ${location.pathname === '/home' ? 'active' : ''}`}>
                                        <Link to="/home">
                                            <div className="svg-container">
                                                <img src={'/Assets/dashboard.svg'} alt="Dashboard" className="nb-image" />
                                            </div>
                                        </Link>
                                    </li>
                                    <li className={`nb-icon ${location.pathname === '/orders' ? 'active' : ''}`}>
                                        <Link to="/orders">
                                            <div className="svg-container">
                                                <img src={'/Assets/orders.svg'} alt="Orders" className={`nb-image ${location.pathname === '/orders' ? 'active' : ''}`} />
                                            </div>
                                        </Link>
                                    </li>
                                    <li className={`nb-icon ${location.pathname === '/profile' ? 'active' : ''}`}>
                                        <Link to="/profile">
                                            <div className="svg-container">
                                                <img src={'/Assets/profile.svg'} alt="Profile" className={`nb-image ${location.pathname === '/profile' ? 'active' : ''}`} />
                                            </div>
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

            {currentUser && userAccountType === 'admin' && (
                <div className="nav-side">
                    <div className="image-wrapper ">
                        <Link to="/admin-analytics" style={{ textDecoration: 'none' }}>
                            <div className="svg-container" style={{ width: '50px', height: '50px' }}>
                                <img src={'/Assets/logo.svg'} alt="Logo" className="nb-logo" />
                            </div>
                        </Link>
                    </div>
                    <div className='nav'>
                        <ul>
                             <li className={`nb-icon ${location.pathname === '/admin-analytics' ? 'active' : ''}`}>
                                <Link to="/admin-analytics">
                               <div className='flex flex-col items-center justify-center'>
                                    <div className="svg-container" style={{ width: '38px', height: '38px' }}>
                                        <img src={'/Assets/analytics.svg'} alt="analytics" className={` nb-image ${location.pathname === '/admin-reimburse' ? 'active' : ''}`} />
                                    </div>
                                    <p className='text-[10px]'>Analytics</p>
                                    </div>
                                </Link>
                            </li>
                            <li className={`nb-icon ${location.pathname === '/admin-incoming-order' ? 'active' : ''}`}>
                                <Link to="/admin-incoming-order">
                                    <div className="svg-container">
                                        <img src={'/Assets/incoming-icons.svg'} alt="Incoming" className={`nb-image ${location.pathname === '/admin-incoming-order' ? 'active' : ''}`} />
                                    </div>
                                </Link>
                            </li>
                            <li className={`nb-icon ${location.pathname === '/admin-users' ? 'active' : ''}`}>
                                <Link to="/admin-users">
                                    <div className="svg-container">
                                        <img src={'/Assets/users-icon.svg'} alt="Users" className={`nb-image ${location.pathname === '/admin-users' ? 'active' : ''}`} />
                                    </div>
                                </Link>
                            </li>
                            <li className={`nb-icon ${location.pathname === '/admin-order-history' ? 'active' : ''}`}>
                                <Link to="/admin-order-history">
                                    <div className="svg-container">
                                        <img src={'/Assets/orders.svg'} alt="Orders" className={`nb-image ${location.pathname === '/admin-order-history' ? 'active' : ''}`} />
                                    </div>
                                </Link>
                            </li>
                            <li className={`nb-icon ${location.pathname === '/admin-dashers' ? 'active' : ''}`}>
                                <Link to="/admin-dashers">
                                    <div className="svg-container">
                                        <img src={'/Assets/dashers-icon.svg'} alt="Dashers" className={`nb-image ${location.pathname === '/admin-dashers' ? 'active' : ''}`} />
                                    </div>
                                </Link>
                            </li>

                            <li className={`nb-icon ${location.pathname === '/admin-shops' ? 'active' : ''}`}>
                                <Link to="/admin-shops">
                                    <div className="svg-container">
                                        <img src={'/Assets/shop.svg'} alt="shops" className={`nb-image ${location.pathname === '/admin-shops' ? 'active' : ''}`} />
                                    </div>
                                </Link>
                            </li>

                            <li className={`nb-icon ${location.pathname === '/admin-cashouts' ? 'active' : ''}`}>
                                <Link to="/admin-cashouts">
                                    <div className="svg-container" style={{ width: '50px', height: '50px' }}>
                                        <img src={'/Assets/cashout.svg'} alt="cashout" className={`nb-image ${location.pathname === '/admin-cashouts' ? 'active' : ''}`} />
                                    </div>
                                </Link>
                            </li>

                            <li className={`nb-icon ${location.pathname === '/admin-reimburse' ? 'active' : ''}`}>
                                <Link to="/admin-reimburse">
                                    <div className="svg-container" style={{ width: '50px', height: '50px' }}>
                                        <img src={'/Assets/reimburses.svg'} alt="cashout" className={`nb-image ${location.pathname === '/admin-reimburse' ? 'active' : ''}`} />
                                    </div>
                                </Link>
                            </li>
                              
                        </ul>
                    </div>
                </div>
            )}

            {currentUser && userAccountType === 'dasher' && (
                <div className="nav-side">
                    <div className="image-wrapper">
                        <Link to="/dasher-orders" style={{ textDecoration: 'none' }}>
                            <div className="svg-container" style={{ width: '50px', height: '50px' }}>
                                <img src={'/Assets/logo.svg'} alt="Logo" className="nb-logo" />
                            </div>
                        </Link>
                    </div>
                    <div className='nav'>
                        <ul>
                            <li className={`nb-icon ${location.pathname === '/dasher-incoming-order' ? 'active' : ''}`}>
                                <Link to="/dasher-incoming-order">
                                    <div className="svg-container">
                                        <img src={'/Assets/incoming-icons.svg'} alt="Incoming" className={`nb-image ${location.pathname === '/dasher-incoming-order' ? 'active' : ''}`} />
                                    </div>
                                </Link>
                            </li>
                            <li className={`nb-icon ${location.pathname === '/dasher-orders' ? 'active' : ''}`}>
                                <Link to="/dasher-orders">
                                    <div className="svg-container">
                                        <img src={'/Assets/orders.svg'} alt="Orders" className={`nb-image ${location.pathname === '/dasher-orders' ? 'active' : ''}`} />
                                    </div>
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            )}

            {currentUser && userAccountType === 'shop' && (
                <div className="nav-side">
                    <div className="h-14 w-14">
                        <Link to="/shop-dashboard" style={{ textDecoration: 'none' }}>
                            <div className="svg-container" style={{ width: '50px', height: '50px' }}>
                                <img src={'/Assets/logo.svg'} alt="Logo" className="nb-logo" />
                            </div>
                        </Link>
                    </div>
                    <div className='nav'>
                        <ul>
                            <li className={`nb-icon ${location.pathname === '/shop-dashboard' ? 'active' : ''}`}>
                                <Link to="/shop-dashboard">
                                    <div className="svg-container">
                                        <img src={'/Assets/dashboard.svg'} alt="Dashboard" className={`nb-image ${location.pathname === '/shop-dashboard' ? 'active' : ''}`} />
                                    </div>
                                </Link>
                            </li>
                            <li className={`nb-icon ${location.pathname === '/shop-add-item' ? 'active' : ''}`}>
                                <Link to="/shop-add-item">
                                    <div className="svg-container">
                                        <img src={'/Assets/add-item.svg'} alt="add item" className={`nb-image ${location.pathname === '/shop-add-item' ? 'active' : ''}`} />
                                    </div>
                                </Link>
                            </li>
                            <li className={`nb-icon ${location.pathname === '/shop-manage-item' ? 'active' : ''}`}>
                                <Link to="/shop-manage-item">
                                    <div className="svg-container">
                                        <img src={'/Assets/manage-items.svg'} alt="Orders" className={`nb-image ${location.pathname === '/shop-manage-item' ? 'active' : ''}`} />
                                    </div>
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            )}

            {showModal && <CartModal showModal={showModal} onClose={closeShowModal} />}
        </div>
        )
    );
}

export default Navbar;
