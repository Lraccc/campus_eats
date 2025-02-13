import React, { useEffect, useState } from "react";
import { useAuth } from "../utils/AuthContext";
import axios from "../utils/axiosConfig"; // Use axios from axiosConfig.js
import AdminAcceptDasherModal from "./AdminAcceptDasherModal";
import AlertModal from "./AlertModal";
import ImageModal from "./ImageModal";
import "./css/AdminDasherLists.css";

const AdminUsers = () => {
    const { currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [accountTypeFilter, setAccountTypeFilter] = useState('regular');
    const [isBannedFilter, setIsBannedFilter] = useState('false');
    const [isVerifiedFilter, setIsVerifiedFilter] = useState('true');
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [onConfirmAction, setOnConfirmAction] = useState(null);
    const [loading,setLoading] = useState(true);

    const openModal = (title, message, confirmAction = null) => {
        setModalTitle(title);
        setModalMessage(message);
        setOnConfirmAction(() => confirmAction);
        setIsAlertModalOpen(true);
    };

    const closeAlertModal = () => {
        setIsAlertModalOpen(false);
        setOnConfirmAction(null);
    };

    const handleBanClick = (userId) => {
        openModal(
            "Confirm Ban",
            "Are you sure you want to block this user?",
            async () => {
                try {
                    const response = await axios.put(`/users/ban/${userId}/${currentUser.id}`,{isBanned: true });
                    // Optionally update the state to remove the declined shop from the list
                    setUsers(users.filter(user => user.id !== userId));
                    openModal("Success", "Successfully updated user status");
                } catch (error) {
                    console.error('Error updating shop status:', error);
                    openModal("Error", "Error updating shop status");
                }
            }
        );
    };

    const handleUnBanClick = (userId) => {
        openModal(
            "Confirm UnBan",
            "Are you sure you want to unblock this user?",
            async () => {
                try {
                    const response = await axios.put(`/users/ban/${userId}/${currentUser.id}`,{isBanned: false });
                    // Optionally update the state to remove the declined shop from the list
                    setUsers(users.filter(user => user.id !== userId));
                    openModal("Success", "Successfully updated user status");
                } catch (error) {
                    console.error('Error updating shop status:', error);
                    openModal("Error", "Error updating shop status");
                }
            }
        );
    };

    const handleDeleteClick = (userId) => {
        openModal(
            "Confirm Delete",
            "Are you sure you want to delete this user?",
            async () => {
                try {
                    console.log('Deleting user with ID:', userId);
                    console.log('Current user ID:', currentUser.id);
                    const response = await axios.delete(`/users/delete/${userId}/${currentUser.id}`);
                    setUsers(users.filter(user => user.id !== userId));
                    openModal("Success", "Successfully deleted user");
                } catch (error) {
                    console.error('Error deleting user:', error);
                    openModal("Error", "Error deleting");
                }
            }
        );
    };

    const handleAccountTypeChange = (e) => {
        setAccountTypeFilter(e.target.value);
    };

    // Handle blocked status filtering
    const handleIsBannedChange = (e) => {
        setIsBannedFilter(e.target.value);
    };

    const handleIsVerifiedChange = (e) => {
        setIsVerifiedFilter(e.target.value);
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        
        // Extracting the components
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
        const day = String(date.getDate()).padStart(2, '0');
        const year = String(date.getFullYear()).slice(-2); // Get last 2 digits of the year
        let hours = date.getHours();
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12; // Convert to 12-hour format
        hours = hours ? String(hours).padStart(2, '0') : '12'; // If hour is 0, set it to 12
    
        return `${month}/${day}/${year} ${hours}:${minutes} ${ampm}`;
    };

    useEffect(() => {
        const fetchUsers = async () => {
            setLoading(true);
            try {
                // Convert isBannedFilter to boolean
                const isBanned = isBannedFilter === 'true'; // 'true' -> true, 'false' -> false

                console.log('Fetching users with filters:', accountTypeFilter, isBanned, isVerifiedFilter);
                const response = await axios.get('/users/filter', {
                    params: {
                        accountType: accountTypeFilter,
                        isBanned: isBanned,
                        isVerified: isVerifiedFilter === 'true'
                    }
                });
                console.log(response.data);
                // Sort the users by the number of offenses (if present)
                const sortedUsers = response.data.sort((a, b) => b.offenses - a.offenses);
                setUsers(sortedUsers);
                
            } catch (error) {
                console.error('Error fetching users:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [accountTypeFilter, isBannedFilter, isVerifiedFilter]);

    return (
        <>
        <AlertModal 
                isOpen={isAlertModalOpen} 
                closeModal={closeAlertModal} 
                title={modalTitle} 
                message={modalMessage} 
                onConfirm={onConfirmAction} 
                showConfirmButton={!!onConfirmAction}
            />      
            <div className="adl-body">
                <div className="adl-title font-semibold">
                    <h2>User Management</h2>
                </div>
                <label htmlFor="accountTypeFilter">Filter by Account Type: </label>
                <select id="accountTypeFilter" value={accountTypeFilter} onChange={handleAccountTypeChange}>
                    <option value="regular">Regular</option>
                    <option value="shop">Shop</option>
                    <option value="dasher">Dasher</option>
                </select>

                <label htmlFor="isBannedFilter">Filter by Banned Status: </label>
                <select id="isBannedFilter" value={isBannedFilter} onChange={handleIsBannedChange}>
                    <option value="true">Banned</option>
                    <option value="false">Active</option>
                </select>

                <label htmlFor="isVerifiedFilter">Filter by Verification Status: </label>
                <select id="isVerifiedFilter" value={isVerifiedFilter} onChange={handleIsVerifiedChange}>
                    <option value="true">Verified</option>
                    <option value="false">Non Verified</option>
                </select>
                {loading ? (<div className="flex justify-center items-center h-[20vh] w-[80vh]">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>): users.length > 0 ? (
                    <>
                        <div className="adl-row-container">
                            <div className="adl-word">Username</div>
                            <div className="adl-word">First Name</div>
                            <div className="adl-word">Last Name</div>
                            {isVerifiedFilter === 'false' ? (
                                <div className="adl-word">Date Created</div>
                            ):(
                                <div className="adl-word">No. of Offenses</div>
                            )}
                            <div className="adl-word">Actions</div>
                            
                        </div>

                        <div className="adl-container">
                            {users.map(user => (
                                <div key={user.id} className="adl-box">
                                    <div className="adl-box-content">
                                        <div>{user.username}</div>
                                        <div>{user.firstname}</div>
                                        <div>{user.lastname}</div>
                                        
                                        {isVerifiedFilter === 'false' ? (
                                            <div>{formatDate(user.dateCreated)}</div>
                                        ):(
                                            <div>{user.offenses}</div>
                                        )
                                        }
                                        <div className="adl-buttons">
                                            {isVerifiedFilter === 'false' && (
                                            <button className="adl-decline" onClick={() => handleDeleteClick(user.id)}>Delete</button>
                                            )}
                                            {isBannedFilter === 'false' ? (
                                                <button className="adl-decline" onClick={() => handleBanClick(user.id)}>Ban</button>
                                            ): (
                                                <button className="adl-acceptorder" onClick={() => handleUnBanClick(user.id)}>Unban</button>
                                            )}
                                        
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div>No users</div>
                )}
            </div>
        </>
    );
};

export default AdminUsers;
