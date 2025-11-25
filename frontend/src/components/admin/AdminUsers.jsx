import React, { useEffect, useState } from "react";
import { useAuth } from "../../utils/AuthContext";
import axios from "../../utils/axiosConfig"; // Use axios from axiosConfig.js
import AdminAcceptDasherModal from "./AdminAcceptDasherModal";
import AlertModal from "../AlertModal";
import ImageModal from "../ImageModal";
import "../css/AdminDasherLists.css";

const AdminUsers = () => {
    const { currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [allUsersCache, setAllUsersCache] = useState(null); // Cache all users
    const [accountTypeFilter, setAccountTypeFilter] = useState('all');
    const [isBannedFilter, setIsBannedFilter] = useState('all');
    const [isVerifiedFilter, setIsVerifiedFilter] = useState('all');
    const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [onConfirmAction, setOnConfirmAction] = useState(null);
    const [loading, setLoading] = useState(true);

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
                    await axios.put(`/users/ban/${userId}/${currentUser.id}`,{isBanned: true });
                    // Invalidate cache and refetch
                    setAllUsersCache(null);
                    openModal("Success", "Successfully updated user status");
                } catch (error) {
                    console.error('Error updating user status:', error);
                    openModal("Error", "Error updating user status");
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
                    await axios.put(`/users/ban/${userId}/${currentUser.id}`,{isBanned: false });
                    // Invalidate cache and refetch
                    setAllUsersCache(null);
                    openModal("Success", "Successfully updated user status");
                } catch (error) {
                    console.error('Error updating user status:', error);
                    openModal("Error", "Error updating user status");
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
                    await axios.delete(`/users/delete/${userId}/${currentUser.id}`);
                    // Invalidate cache and refetch
                    setAllUsersCache(null);
                    openModal("Success", "Successfully deleted user");
                } catch (error) {
                    console.error('Error deleting user:', error);
                    openModal("Error", "Error deleting user");
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
                // Check if we already have cached data
                let allUsers = allUsersCache;
                
                if (!allUsers) {
                    console.log('Fetching all users from backend...');
                    const response = await axios.get('/users');
                    console.log('Response received:', response.data);
                    
                    if (response.data && Array.isArray(response.data)) {
                        allUsers = response.data;
                        setAllUsersCache(allUsers); // Cache the data
                        console.log('Cached', allUsers.length, 'users');
                    } else {
                        console.warn('Invalid response format:', response.data);
                        setUsers([]);
                        setLoading(false);
                        return;
                    }
                } else {
                    console.log('Using cached user data');
                }
                
                // Filter users on frontend based on selected criteria
                const filteredUsers = allUsers.filter(user => {
                    // Filter by account type
                    const matchesAccountType = accountTypeFilter === 'all' || user.accountType === accountTypeFilter;
                    
                    // Filter by banned status
                    const matchesBannedStatus = isBannedFilter === 'all' || user.isBanned === (isBannedFilter === 'true');
                    
                    // Filter by verification status
                    const matchesVerificationStatus = isVerifiedFilter === 'all' || user.isVerified === (isVerifiedFilter === 'true');
                    
                    return matchesAccountType && matchesBannedStatus && matchesVerificationStatus;
                });
                
                console.log('Filtered users:', filteredUsers.length, 'out of', allUsers.length);
                
                // Sort the users by the number of offenses (if present)
                const sortedUsers = filteredUsers.sort((a, b) => (b.offenses || 0) - (a.offenses || 0));
                setUsers(sortedUsers);
                
            } catch (error) {
                console.error('Error fetching users:', error);
                console.error('Error details:', error.response?.data);
                setUsers([]);
                openModal("Error", "Failed to fetch users. Please check the console for details.");
            } finally {
                setLoading(false);
            }
        };

        fetchUsers();
    }, [accountTypeFilter, isBannedFilter, isVerifiedFilter, allUsersCache]);

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
                <div className="mb-6">
                    <h2 className="text-2xl font-bold text-[#8B4513] mb-4">User Management</h2>
                    <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl shadow-md">
                        <div className="flex flex-col gap-1">
                            <label htmlFor="accountTypeFilter" className="text-sm font-semibold text-[#8B4513]">Account Type</label>
                            <select 
                                id="accountTypeFilter" 
                                value={accountTypeFilter} 
                                onChange={handleAccountTypeChange}
                                className="px-4 py-2 border-2 border-[#BC4A4D] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BC4A4D] bg-white text-[#8B4513] font-medium"
                            >
                                <option value="all">All</option>
                                <option value="regular">Regular</option>
                                <option value="shop">Shop</option>
                                <option value="dasher">Dasher</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label htmlFor="isBannedFilter" className="text-sm font-semibold text-[#8B4513]">Banned Status</label>
                            <select 
                                id="isBannedFilter" 
                                value={isBannedFilter} 
                                onChange={handleIsBannedChange}
                                className="px-4 py-2 border-2 border-[#BC4A4D] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BC4A4D] bg-white text-[#8B4513] font-medium"
                            >
                                <option value="all">All</option>
                                <option value="false">Active</option>
                                <option value="true">Banned</option>
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label htmlFor="isVerifiedFilter" className="text-sm font-semibold text-[#8B4513]">Verification Status</label>
                            <select 
                                id="isVerifiedFilter" 
                                value={isVerifiedFilter} 
                                onChange={handleIsVerifiedChange}
                                className="px-4 py-2 border-2 border-[#BC4A4D] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#BC4A4D] bg-white text-[#8B4513] font-medium"
                            >
                                <option value="all">All</option>
                                <option value="true">Verified</option>
                                <option value="false">Non Verified</option>
                            </select>
                        </div>
                    </div>
                </div>
                {loading ? (
                    <div className="flex justify-center items-center h-[40vh] w-full">
                        <div className="flex flex-col items-center gap-4">
                            <div
                                className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                                role="status">
                                <span
                                    className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                                >Loading...</span>
                            </div>
                            <p className="text-[#8B4513] font-semibold">Loading users...</p>
                        </div>
                    </div>
                ) : users.length > 0 ? (
                    <>
                        <div className="bg-[#BC4A4D] text-white rounded-t-xl px-6 py-4 grid grid-cols-5 gap-4 font-bold text-sm">
                            <div>Username</div>
                            <div>First Name</div>
                            <div>Last Name</div>
                            {isVerifiedFilter === 'false' ? (
                                <div>Date Created</div>
                            ):(
                                <div>No. of Offenses</div>
                            )}
                            <div className="text-center">Actions</div>
                        </div>

                        <div className="bg-white rounded-b-xl shadow-lg overflow-hidden">
                            {users.map((user, index) => (
                                <div 
                                    key={user.id} 
                                    className={`grid grid-cols-5 gap-4 px-6 py-4 items-center hover:bg-[#FFFAF1] transition-colors ${
                                        index !== users.length - 1 ? 'border-b border-gray-200' : ''
                                    }`}
                                >
                                    <div className="font-medium text-[#8B4513] truncate">{user.username}</div>
                                    <div className="text-[#8B4513] truncate">{user.firstname}</div>
                                    <div className="text-[#8B4513] truncate">{user.lastname}</div>
                                    
                                    {isVerifiedFilter === 'false' ? (
                                        <div className="text-sm text-[#8B4513]">{formatDate(user.dateCreated)}</div>
                                    ):(
                                        <div className="font-semibold text-[#BC4A4D]">{user.offenses || 0}</div>
                                    )}
                                    <div className="flex gap-2 justify-center">
                                        {isVerifiedFilter === 'false' && (
                                            <button 
                                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg" 
                                                onClick={() => handleDeleteClick(user.id)}
                                            >
                                                Delete
                                            </button>
                                        )}
                                        {isBannedFilter === 'false' ? (
                                            <button 
                                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg" 
                                                onClick={() => handleBanClick(user.id)}
                                            >
                                                Ban
                                            </button>
                                        ) : (
                                            <button 
                                                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors shadow-md hover:shadow-lg" 
                                                onClick={() => handleUnBanClick(user.id)}
                                            >
                                                Unban
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[40vh] bg-white rounded-xl shadow-md">
                        <div className="text-6xl mb-4">📭</div>
                        <h3 className="text-xl font-bold text-[#8B4513] mb-2">No Users Found</h3>
                        <p className="text-[#8B4513] opacity-70">Try adjusting your filters</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default AdminUsers;
