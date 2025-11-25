import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SuperAdminDashboard.css';

interface Campus {
  id: string;
  name: string;
  address: string;
  centerLatitude: number;
  centerLongitude: number;
  geofenceRadius: number;
  adminId: string | null;
  isActive: boolean;
  dateCreated: string;
}

interface CampusStats {
  campusId: string;
  shopCount: number;
  dasherCount: number;
  userCount: number;
}

interface AdminUser {
  id: string;
  username: string;
  email: string;
  accountType: string;
  campusId: string | null;
}

interface SuperAdminDashboardProps {
  userId: string; // Superadmin user ID
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ userId }) => {
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [campusStats, setCampusStats] = useState<Map<string, CampusStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null);

  // Form states
  const [campusForm, setCampusForm] = useState({
    name: '',
    address: '',
    centerLatitude: '',
    centerLongitude: '',
    geofenceRadius: '',
  });

  const [adminForm, setAdminForm] = useState({
    username: '',
    email: '',
    password: '',
    firstname: '',
    lastname: '',
  });

  const [selectedAdminId, setSelectedAdminId] = useState('');
  const API_BASE = (window as any).ENV?.REACT_APP_API_BASE_URL || 'http://localhost:8080';

  useEffect(() => {
    fetchCampuses();
    fetchAdmins();
  }, []);

  useEffect(() => {
    // Fetch stats whenever campuses change
    if (campuses.length > 0) {
      fetchAllCampusStats();
    }
  }, [campuses]);

  const fetchCampuses = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/campuses`, {
        params: { userId },
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
      });
      console.log('Fetched campuses:', response.data);
      setCampuses(response.data);
    } catch (error) {
      console.error('Error fetching campuses:', error);
      alert('Failed to load campuses');
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/users`);
      // Filter for admin users without campus assignment
      const adminUsers = response.data.filter(
        (user: AdminUser) => user.accountType === 'admin'
      );
      setAdmins(adminUsers);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const fetchAllCampusStats = async () => {
    try {
      const statsMap = new Map<string, CampusStats>();
      
      // Fetch stats for each campus in parallel
      await Promise.all(
        campuses.map(async (campus) => {
          try {
            const response = await axios.get(`${API_BASE}/api/campuses/${campus.id}/stats`);
            statsMap.set(campus.id, response.data);
          } catch (error) {
            console.error(`Error fetching stats for campus ${campus.id}:`, error);
            // Set default values if fetch fails
            statsMap.set(campus.id, {
              campusId: campus.id,
              shopCount: 0,
              dasherCount: 0,
              userCount: 0
            });
          }
        })
      );
      
      setCampusStats(statsMap);
    } catch (error) {
      console.error('Error fetching campus stats:', error);
    }
  };

  const handleCreateCampus = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedAdminId) {
      alert('Please select an admin for this campus');
      return;
    }

    try {
      const campusData = {
        name: campusForm.name,
        address: campusForm.address,
        centerLatitude: parseFloat(campusForm.centerLatitude),
        centerLongitude: parseFloat(campusForm.centerLongitude),
        geofenceRadius: parseFloat(campusForm.geofenceRadius),
      };

      await axios.post(`${API_BASE}/api/campuses`, campusData, {
        params: { adminId: selectedAdminId, userId }
      });

      alert('Campus created successfully!');
      setShowCreateModal(false);
      resetCampusForm();
      fetchCampuses();
      fetchAdmins();
    } catch (error: any) {
      console.error('Error creating campus:', error);
      alert(error.response?.data || 'Failed to create campus');
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await axios.post(`${API_BASE}/api/users/create-admin`, adminForm, {
        params: { creatorId: userId }
      });

      alert('Admin user created successfully!');
      setShowAdminModal(false);
      resetAdminForm();
      fetchAdmins();
    } catch (error: any) {
      console.error('Error creating admin:', error);
      alert(error.response?.data || 'Failed to create admin user');
    }
  };

  const handleUpdateCampus = async (campusId: string, updates: Partial<Campus>) => {
    try {
      await axios.put(`${API_BASE}/api/campuses/${campusId}`, updates, {
        params: { userId }
      });

      alert('Campus updated successfully!');
      fetchCampuses();
    } catch (error: any) {
      console.error('Error updating campus:', error);
      alert(error.response?.data || 'Failed to update campus');
    }
  };

  const handleReassignAdmin = async (campusId: string, newAdminId: string) => {
    try {
      await axios.put(
        `${API_BASE}/api/campuses/${campusId}/assign-admin`,
        null,
        { params: { adminId: newAdminId, userId } }
      );

      alert('Admin reassigned successfully!');
      fetchCampuses();
      fetchAdmins();
    } catch (error: any) {
      console.error('Error reassigning admin:', error);
      alert(error.response?.data || 'Failed to reassign admin');
    }
  };

  const handleToggleCampusStatus = async (campusId: string) => {
    try {
      const response = await axios.put(
        `${API_BASE}/api/campuses/${campusId}/toggle-status`,
        null,
        { 
          params: { userId },
          headers: { 'Cache-Control': 'no-cache' }
        }
      );

      console.log('Toggle response:', response.data);
      alert('Campus status updated!');
      
      // Force refresh the campuses list
      await fetchCampuses();
    } catch (error: any) {
      console.error('Error toggling campus status:', error);
      alert(error.response?.data || 'Failed to update campus status');
    }
  };

  const handleDeleteCampus = async (campusId: string) => {
    if (!window.confirm('Are you sure you want to delete this campus? This action cannot be undone.')) {
      return;
    }

    try {
      await axios.delete(`${API_BASE}/api/campuses/${campusId}`, {
        params: { userId }
      });

      alert('Campus deleted successfully!');
      fetchCampuses();
      fetchAdmins();
    } catch (error: any) {
      console.error('Error deleting campus:', error);
      alert(error.response?.data || 'Failed to delete campus');
    }
  };

  const resetCampusForm = () => {
    setCampusForm({
      name: '',
      address: '',
      centerLatitude: '',
      centerLongitude: '',
      geofenceRadius: '',
    });
    setSelectedAdminId('');
  };

  const resetAdminForm = () => {
    setAdminForm({
      username: '',
      email: '',
      password: '',
      firstname: '',
      lastname: '',
    });
  };

  const getAdminName = (adminId: string | null) => {
    if (!adminId) return 'No Admin Assigned';
    const admin = admins.find(a => a.id === adminId);
    return admin ? `${admin.username} (${admin.email})` : 'Unknown Admin';
  };

  const getAvailableAdmins = () => {
    return admins.filter(admin => !admin.campusId);
  };

  if (loading) {
    return <div className="dashboard-loading">Loading...</div>;
  }

  return (
    <div className="superadmin-dashboard">
      <div className="dashboard-header">
        <h1>Super Admin Dashboard</h1>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => setShowAdminModal(true)}>
            Create Admin User
          </button>
          <button className="btn btn-success" onClick={() => setShowCreateModal(true)}>
            Create Campus
          </button>
        </div>
      </div>

      <div className="campuses-grid">
        {campuses.map((campus) => {
          console.log('Rendering campus:', campus.name, 'isActive:', campus.isActive);
          const stats = campusStats.get(campus.id);
          return (
          <div key={campus.id} className={`campus-card ${!campus.isActive ? 'inactive' : ''}`}>
            <div className="campus-header">
              <h3>{campus.name}</h3>
              <span className={`status-badge ${campus.isActive ? 'active' : 'inactive'}`}>
                {campus.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            {/* Campus Statistics */}
            {stats && (
              <div className="campus-stats">
                <div className="stat-item">
                  <span className="stat-icon">🏪</span>
                  <div className="stat-info">
                    <span className="stat-value">{stats.shopCount}</span>
                    <span className="stat-label">Shops</span>
                  </div>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">🚴</span>
                  <div className="stat-info">
                    <span className="stat-value">{stats.dasherCount}</span>
                    <span className="stat-label">Dashers</span>
                  </div>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">👥</span>
                  <div className="stat-info">
                    <span className="stat-value">{stats.userCount}</span>
                    <span className="stat-label">Users</span>
                  </div>
                </div>
              </div>
            )}

            <div className="campus-details">
              <p><strong>Address:</strong> {campus.address}</p>
              <p><strong>Center:</strong> {campus.centerLatitude.toFixed(6)}, {campus.centerLongitude.toFixed(6)}</p>
              <p><strong>Geofence Radius:</strong> {campus.geofenceRadius} meters</p>
              <p><strong>Admin:</strong> {getAdminName(campus.adminId)}</p>
              <p><strong>Created:</strong> {new Date(campus.dateCreated).toLocaleDateString()}</p>
            </div>

            <div className="campus-actions">
              <button
                className="btn btn-sm btn-warning"
                onClick={() => handleToggleCampusStatus(campus.id)}
              >
                {campus.isActive ? 'Deactivate' : 'Activate'}
              </button>
              
              <button
                className="btn btn-sm btn-info"
                onClick={() => {
                  const newAdminId = prompt('Enter new admin ID to reassign:');
                  if (newAdminId) handleReassignAdmin(campus.id, newAdminId);
                }}
              >
                Reassign Admin
              </button>

              <button
                className="btn btn-sm btn-secondary"
                onClick={() => {
                  const newRadius = prompt('Enter new geofence radius (meters):', campus.geofenceRadius.toString());
                  if (newRadius) {
                    handleUpdateCampus(campus.id, { geofenceRadius: parseFloat(newRadius) });
                  }
                }}
              >
                Update Geofence
              </button>

              <button
                className="btn btn-sm btn-danger"
                onClick={() => handleDeleteCampus(campus.id)}
              >
                Delete
              </button>
            </div>
          </div>
          );
        })}
      </div>

      {/* Create Campus Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Campus</h2>
            <form onSubmit={handleCreateCampus}>
              <div className="form-group">
                <label>Campus Name *</label>
                <input
                  type="text"
                  required
                  value={campusForm.name}
                  onChange={(e) => setCampusForm({ ...campusForm, name: e.target.value })}
                  placeholder="e.g., University of XYZ"
                />
              </div>

              <div className="form-group">
                <label>Address *</label>
                <input
                  type="text"
                  required
                  value={campusForm.address}
                  onChange={(e) => setCampusForm({ ...campusForm, address: e.target.value })}
                  placeholder="Full campus address"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Center Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={campusForm.centerLatitude}
                    onChange={(e) => setCampusForm({ ...campusForm, centerLatitude: e.target.value })}
                    placeholder="e.g., 10.295663"
                  />
                </div>

                <div className="form-group">
                  <label>Center Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={campusForm.centerLongitude}
                    onChange={(e) => setCampusForm({ ...campusForm, centerLongitude: e.target.value })}
                    placeholder="e.g., 123.880895"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Geofence Radius (meters) *</label>
                <input
                  type="number"
                  required
                  value={campusForm.geofenceRadius}
                  onChange={(e) => setCampusForm({ ...campusForm, geofenceRadius: e.target.value })}
                  placeholder="e.g., 500"
                />
              </div>

              <div className="form-group">
                <label>Assign Admin *</label>
                <select
                  required
                  value={selectedAdminId}
                  onChange={(e) => setSelectedAdminId(e.target.value)}
                >
                  <option value="">Select an admin...</option>
                  {getAvailableAdmins().map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.username} ({admin.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Campus
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Admin Modal */}
      {showAdminModal && (
        <div className="modal-overlay" onClick={() => setShowAdminModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create Admin User</h2>
            <form onSubmit={handleCreateAdmin}>
              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  required
                  value={adminForm.username}
                  onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                  placeholder="Admin username"
                />
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  required
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  placeholder="admin@example.com"
                />
              </div>

              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  required
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  placeholder="Strong password"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    value={adminForm.firstname}
                    onChange={(e) => setAdminForm({ ...adminForm, firstname: e.target.value })}
                    placeholder="First name"
                  />
                </div>

                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={adminForm.lastname}
                    onChange={(e) => setAdminForm({ ...adminForm, lastname: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdminModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Admin
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
