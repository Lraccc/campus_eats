import React, { useState, useEffect, useContext } from "react";
import "./css/ForgotPassword.css";
import { useAuth } from "../utils/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "../utils/axiosConfig";
import AlertModal from "./AlertModal";

const PWD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,24}$/;


const ResetPassword = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [userid, setUserId] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [newPasswordFocus, setNewPasswordFocus] = useState(false);
    const [confirmPasswordFocus, setConfirmPasswordFocus] = useState(false);
    const [validNewPassword, setValidNewPassword] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const email = location.state && location.state.email;

    const [alertModal, setAlertModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        showConfirmButton: false,
    });

    useEffect(() => {
        document.title = "Campus Eats";

        // Fetch userid based on the provided email
        if (email) {
            axios.get(`/users/by-email/${email}`)
                .then((response) => {
                    const fetchedUser = response.data;
                    if (fetchedUser && fetchedUser.id) {
                        setUserId(fetchedUser.id);
                    } else {
                        console.error('Email not found or userid not retrieved');
                    }
                })
                .catch((error) => {
                    console.error('Error fetching userid:', error);
                });
        }
    }, [email]);

    if (!email) {
        return <div className="fp-main">
                    <span className="small-text "style={{ color: 'white' }}>This page is for admin-only access. You don't have the necessary privileges to view this content.</span>
                </div>
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        const v1 = PWD_REGEX.test(newPassword);
        if (!v1) {
            setError("Password must be 8-24 characters long and contain at least one lowercase letter, one uppercase letter, and one number.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        const updatedUserData = {
            id: userid,
            password: newPassword
        };

        try {
            const response = await axios.put(`/users/update/${userid}`, updatedUserData);

            if (response.status === 200) {
                setSuccess('Password updated successfully.');
                setAlertModal({
                    isOpen: true,
                    title: 'Success',
                    message: 'Password updated successfully. You may now log in with your new password.',
                    showConfirmButton: false,
                });
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } else {
                console.error('Update failed:', response.statusText);
                setError('Error updating user data');
            }
        } catch (error) {
            console.error('Error during update:', error.message);
            setError('Error updating user data');
        }
    };

    return (
        <>
        <AlertModal
                isOpen={alertModal.isOpen}
                closeModal={() => setAlertModal({ ...alertModal, isOpen: false })}
                title={alertModal.title}
                message={alertModal.message}
                onConfirm={alertModal.onConfirm}
                showConfirmButton={alertModal.showConfirmButton}
            />  
        <main className="fp-main">
            <div className={`fp-box fp-half-box`}>
                <div className="fp-inner-box">
                    <div className="fp-forms-wrap">
                        <form className="fp-form" onSubmit={handleSubmit}>
                            <div className="fp-header">
                                <h1>Reset Password</h1>
                            </div>
                            {!loading && error && (
                                <div className="ls-error">
                                    <span>{error}</span>
                                </div>
                            )}
                            {!loading && success && (
                                <div className="ls-success">
                                    <span>{success}</span>
                                </div>
                            )}
                            <div className="fp-actual-form">
                                <div className="fp-input-wrap">
                                    <input
                                        type="password"
                                        id="newPassword"
                                        required
                                        disabled={loading}
                                        className={`fp-input-field ${newPasswordFocus || newPassword ? 'active' : ''}`}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        aria-invalid={validNewPassword ? "false" : "true"}
                                        aria-describedby="uidnote"
                                        onFocus={() => setNewPasswordFocus(true)}
                                        onBlur={() => setNewPasswordFocus(false)}
                                    />
                                    <label>New Password</label>
                                </div>
                                <div className="fp-input-wrap">
                                    <input
                                        type="password"
                                        id="confirmPassword"
                                        required
                                        readOnly={loading}
                                        className={`fp-input-field ${confirmPasswordFocus || confirmPassword ? 'active' : ''}`}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        onFocus={() => setConfirmPasswordFocus(true)}
                                        onBlur={() => setConfirmPasswordFocus(false)}
                                    />
                                    <label>Confirm New Password</label>
                                </div>
                                <button disabled={loading || !confirmPassword} type="submit" className="fp-btn">
                                    Submit
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </main>
        </>
    );
}

export default ResetPassword;
