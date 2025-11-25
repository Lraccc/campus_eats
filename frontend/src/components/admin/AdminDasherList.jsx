import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../utils/AuthContext";
import axios from "../../utils/axiosConfig";
import AlertModal from "../AlertModal";
import "../css/AdminDasherLists.css";

const AdminDasherList = () => {
    const { currentUser } = useAuth();
    const [pendingDashers, setPendingDashers] = useState([]);
    const [currentDashers, setCurrentDashers] = useState([]);
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [onConfirmAction, setOnConfirmAction] = useState(null);
    const [loading, setLoading] = useState(true);

    const openModal = (title, message, confirmAction = null) => {
        setModalTitle(title);
        setModalMessage(message);
        setOnConfirmAction(() => confirmAction);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setOnConfirmAction(null);
    };

    const handleDeclineClick = async (dasherId) => {
        openModal(
            'Confirm Decline',
            'Are you sure you want to decline this dasher?',
            async () => {
                try {
                    await axios.put(`/dashers/update/${dasherId}/status`, null, { params: { status: 'declined' } });
                    openModal('Success', 'Dasher status updated successfully');
                    setTimeout(() => {
                        closeModal();
                        window.location.reload();
                    }, 3000);
                } catch (error) {
                    console.error('Error updating dasher status:', error);
                    openModal('Error', 'Error updating dasher status');
                }
            }
        );
    };

    const handleAcceptClick = async (dasherId) => {
        openModal(
            'Confirm Accept',
            'Are you sure you want to accept this dasher?',
            async () => {
                try {
                    await axios.put(`/dashers/update/${dasherId}/status`, null, { params: { status: 'offline' } });
                    await axios.put(`/users/update/${dasherId}/accountType`, null, {
                        params: {
                            accountType: "dasher"
                        }
                    });
                    openModal('Success', 'Dasher status and account type updated successfully');
                    setTimeout(() => {
                        closeModal();
                        window.location.reload();
                    }, 3000);
                } catch (error) {
                    console.error('Error updating dasher status or account type:', error);
                    openModal('Error', 'Error updating dasher status or account type');
                }
            }
        );
    };

    useEffect(() => {
        const fetchDashers = async () => {
            setLoading(true);
            try {
                // Fetch dashers and all users in parallel for better performance
                const [dashersResponse, usersResponse] = await Promise.all([
                    axios.get('/dashers/pending-lists'),
                    axios.get('/users')
                ]);
                
                const pendingDashersHold = dashersResponse.data.pendingDashers || [];
                const currentDashersHold = dashersResponse.data.nonPendingDashers || [];
                const allUsers = usersResponse.data || [];
                
                // Create a user map for O(1) lookups instead of N individual API calls
                const userMap = new Map(allUsers.map(user => [user.id, user]));
                
                // Map dashers with their user data from the userMap (no additional API calls)
                const pendingDashersData = pendingDashersHold.map(dasher => ({
                    ...dasher,
                    userData: userMap.get(dasher.id) || null
                }));
                
                const currentDashersData = currentDashersHold.map(dasher => ({
                    ...dasher,
                    userData: userMap.get(dasher.id) || null
                }));
                
                console.log("pendingDashersData: ", pendingDashersData);
                console.log("currentDashersData: ", currentDashersData);

                setPendingDashers(pendingDashersData);
                setCurrentDashers(currentDashersData);
            } catch (error) {
                console.error('Error fetching dashers:', error);
                openModal('Error', 'Failed to load dashers. Please try again.');
                setPendingDashers([]);
                setCurrentDashers([]);
            } finally {
                setLoading(false);
            }
        };

        fetchDashers();
        console.log("currentUser: ", currentUser);
    }, [currentUser]);

    if(!currentUser){
        navigate('/login');
    }

    return (
        <>
            <AlertModal 
                isOpen={isModalOpen} 
                closeModal={closeModal} 
                title={modalTitle} 
                message={modalMessage} 
                onConfirm={onConfirmAction} 
                showConfirmButton={!!onConfirmAction}
            />
            <div className="adl-body">
                <div className="mb-6">
                    <div className="bg-white p-4 rounded-xl shadow-md">
                        <h2 className="text-2xl font-bold text-[#8B4513] mb-1">Pending Dashers</h2>
                        <p className="text-[#8B4513] text-sm">Review and approve dasher applications</p>
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
                            <p className="text-[#8B4513] font-semibold">Loading pending dashers...</p>
                        </div>
                    </div>
                ) : pendingDashers && pendingDashers.length > 0 ? (
                    <>
                        <div className="adl-row-container">
                            <div className="adl-word">Dasher Name</div>
                            <div className="adl-word">Days Available</div>
                            <div className="adl-word">Start Time</div>
                            <div className="adl-word">End Time</div>
                            <div className="adl-word">School ID</div>
                            <div className="adl-word">Actions</div>
                        </div>

                        <div className="adl-container">
                            {pendingDashers.map(dasher => (
                                <div key={dasher.id} className="adl-box">
                                    {console.log("dasher pending: ", dasher.userData.firstname)}
                                    <div className="adl-box-content">
                                    <div>{dasher.userData ? `${dasher.userData.firstname || ''} ${dasher.userData.lastname || ''}` : 'Unknown User'}</div>
                                        <div>{dasher.daysAvailable.join(', ')}</div>
                                        <div>{dasher.availableStartTime}</div>
                                        <div>{dasher.availableEndTime}</div>
                                        <div>
                                            <img src={dasher.schoolId} alt="School ID" className="adl-list-pic" />
                                        </div>
                                        <div className="adl-buttons">
                                            <button className="adl-decline" onClick={() => handleDeclineClick(dasher.id)}>Decline</button>
                                            <button className="adl-acceptorder" onClick={() => handleAcceptClick(dasher.id)}>Accept</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="p-8 text-center bg-white rounded-xl border-2 border-gray-200 shadow-md">
                        <svg className="mx-auto h-16 w-16 text-[#BC4A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <h3 className="mt-3 text-lg font-bold text-[#8B4513]">No pending dashers</h3>
                        <p className="mt-2 text-sm text-[#8B4513]">There are currently no dasher applications to review.</p>
                    </div>
                )}

                <div className="mb-6 mt-8">
                    <div className="bg-white p-4 rounded-xl shadow-md">
                        <h2 className="text-2xl font-bold text-[#8B4513] mb-1">Active Dashers</h2>
                        <p className="text-[#8B4513] text-sm">All approved and active dashers on the platform</p>
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
                            <p className="text-[#8B4513] font-semibold">Loading active dashers...</p>
                        </div>
                    </div>
                ) : currentDashers && currentDashers.length > 0 ? (
                    <>
                        <div className="bg-white rounded-xl shadow-md overflow-hidden">
                            <div className="grid grid-cols-6 gap-4 p-4 bg-[#BC4A4D] text-white font-bold text-sm">
                                <div>Dasher Name</div>
                                <div>Days Available</div>
                                <div>Start Time</div>
                                <div>End Time</div>
                                <div>School ID</div>
                                <div>Status</div>
                            </div>

                            <div className="divide-y divide-gray-200">
                                {currentDashers.map(dasher => (
                                    <div key={dasher.id} className="grid grid-cols-6 gap-4 p-4 hover:bg-[#FFFAF1] transition-colors items-center">
                                        <div className="font-semibold text-[#8B4513]">
                                            {dasher.userData ? `${dasher.userData.firstname || ''} ${dasher.userData.lastname || ''}` : 'Unknown User'}
                                        </div>
                                        <div className="text-[#8B4513] text-sm">{dasher.daysAvailable.join(', ')}</div>
                                        <div className="text-[#8B4513] text-sm">{dasher.availableStartTime}</div>
                                        <div className="text-[#8B4513] text-sm">{dasher.availableEndTime}</div>
                                        <div className="flex justify-center">
                                            <img src={dasher.schoolId} alt="School ID" className="w-16 h-16 object-cover rounded-lg shadow-md border-2 border-gray-200" />
                                        </div>
                                        <div>
                                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
                                                dasher.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                            }`}>
                                                {dasher.status}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="p-8 text-center bg-white rounded-xl border-2 border-gray-200 shadow-md">
                        <svg className="mx-auto h-16 w-16 text-[#BC4A4D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <h3 className="mt-3 text-lg font-bold text-[#8B4513]">No active dashers</h3>
                        <p className="mt-2 text-sm text-[#8B4513]">There are currently no active dashers on the platform.</p>
                    </div>
                )}
            </div>
        </>
    );
};

export default AdminDasherList;
