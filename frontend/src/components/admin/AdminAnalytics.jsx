import TabContext from '@mui/lab/TabContext';
import TabPanel from '@mui/lab/TabPanel';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { red } from '@mui/material/colors';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';

import { useEffect, useState, createContext, useContext, useMemo } from 'react';
import axios from "../../utils/axiosConfig";

// Create context for shared data across tabs
const AdminDataContext = createContext(null);

// Custom hook to use shared data
const useAdminData = () => {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error('useAdminData must be used within AdminDataProvider');
  }
  return context;
};

// Data Provider Component to fetch and cache shared data
const AdminDataProvider = ({ children }) => {
  const [sharedData, setSharedData] = useState({
    orders: null,
    shops: null,
    dashers: null,
    users: null,
    isLoading: false,
    error: null,
    lastFetchTime: null
  });

  const fetchSharedData = async (forceRefresh = false) => {
    // Cache data for 5 minutes
    const CACHE_DURATION = 5 * 60 * 1000;
    const now = Date.now();
    
    if (!forceRefresh && sharedData.lastFetchTime && (now - sharedData.lastFetchTime < CACHE_DURATION)) {
      return; // Use cached data
    }

    setSharedData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Fetch all data in parallel
      const [orderResponse, shopResponse, dasherResponse, userResponse] = await Promise.all([
        axios.get('/orders/completed-orders'),
        axios.get('/shops/pending-lists'),
        axios.get('/dashers/pending-lists'),
        axios.get('/users')
      ]);

      const orders = orderResponse.data.completedOrders;
      const { pendingShops, nonPendingShops } = shopResponse.data;
      const { pendingDashers, nonPendingDashers } = dasherResponse.data;
      const users = userResponse.data;

      // Create user map for efficient lookups
      const userMap = new Map(users.map(user => [user.id, user]));

      // Enrich dasher data with user info
      const enrichedDashers = nonPendingDashers.map(dasher => ({
        ...dasher,
        userData: userMap.get(dasher.id) || null
      }));

      setSharedData({
        orders,
        shops: { pending: pendingShops, active: nonPendingShops.filter(shop => shop.status === 'active') },
        dashers: { 
          pending: pendingDashers,
          active: enrichedDashers.filter(d => d.status === 'active' || d.status === 'offline'),
          all: enrichedDashers
        },
        users,
        isLoading: false,
        error: null,
        lastFetchTime: now
      });
    } catch (error) {
      console.error('Error fetching shared data:', error);
      setSharedData(prev => ({
        ...prev,
        isLoading: false,
        error: error.response?.data?.error || error.message
      }));
    }
  };

  useEffect(() => {
    fetchSharedData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({
    ...sharedData,
    refetch: fetchSharedData
  }), [sharedData]);

  return (
    <AdminDataContext.Provider value={value}>
      {children}
    </AdminDataContext.Provider>
  );
};

const OverAllAnalytics = () => {
  const { orders, shops, dashers, users, isLoading: sharedLoading } = useAdminData();
  const [allOrders, setAllOrders] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [pendingShops, setPendingShops] = useState([]);
  const [currentShops, setCurrentShops] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [allDashers, setAllDashers] = useState([]);
  const [currentDashers, setCurrentDashers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [usersState, setUsers] = useState([]);
  const [page, setPage] = useState(1);

  // Use shared data when available
  useEffect(() => {
    if (orders && shops && dashers && users) {
      setAllOrders(orders);
      setPendingShops(shops.pending);
      setCurrentShops(shops.active);
      setAllDashers(dashers.all);
      setCurrentDashers(dashers.active);
      setUsers(users);
      setLoading(false);
    } else if (sharedLoading) {
      setLoading(true);
    }
  }, [orders, shops, dashers, users, sharedLoading]);

  // No longer need to fetch - data comes from shared context
  // Keeping function signature for compatibility but it does nothing
  const fetchAllOrdersShopsDashersUsers = async () => {
    // Data is now loaded from shared context
  };

  const userStats = (usersState || []).filter(user => user && user.firstname && user.lastname)
    .map(user => {
      const userOrders = allOrders.filter(order => order.uid === user.id);
      const completedOrders = userOrders.filter(order => order.status === 'completed').length;
      const cancelledOrders = userOrders.filter(order => order.status?.includes('cancelled_by_customer')).length;
      const totalOrders = completedOrders + cancelledOrders;

      return {
        userName: `${user.firstname} ${user.lastname}`,
        completedOrders,
        cancelledOrders,
        totalOrders
      };
    }).sort((a, b) => b.totalOrders - a.totalOrders);

  const shopStats = currentShops.map(shop => {
    const shopOrders = allOrders.filter(order => order.shopId === shop.id);
    const completedOrders = shopOrders.filter(order => order.status === 'completed').length;
    const cancelledOrders = shopOrders.filter(order => order.status.includes('cancelled_by_shop')).length;
    const totalOrders = completedOrders + cancelledOrders;

    return { 
      shopName: shop.name,
      completedOrders,
      cancelledOrders,
      totalOrders
    };
  }).sort((a, b) => b.totalOrders - a.totalOrders);

  const dasherStats = (currentDashers || []).filter(dasher => dasher && dasher.userData)
    .map(dasher => {
      const dasherOrders = allOrders.filter(order => order.dasherId === dasher.id);
      const completedOrders = dasherOrders.filter(order => order.status === 'completed').length;
      const cancelledOrders = dasherOrders.filter(order => order.status?.includes('cancelled_by_dasher')).length;
      const totalOrders = completedOrders + cancelledOrders;

      return {
        dasherName: `${dasher.userData.firstname || ''} ${dasher.userData.lastname || ''}`,
        completedOrders,
        cancelledOrders,
        totalOrders
      };
    }).sort((a, b) => b.totalOrders - a.totalOrders);

  const userOrderMessages = (users || []).filter(user => user && user.firstname && user.lastname)
    .flatMap(user => {
      const userOrders = allOrders.filter(order => order.uid === user.id && ['completed', 'cancelled_by_customer', 'no-show'].includes(order.status));
      return userOrders.map(order => {
        let action;
        if (order.status === 'completed') {
            action = 'completed';
        } else if (order.status === 'no-show') {
            action = 'not shown to pick up';
        } else {
            action = 'cancelled';
        }
        return {
            message: `(User) ${user.firstname} ${user.lastname} has ${action} an order`,
            createdAt: order.createdAt
        };
      });
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const dasherOrderMessages = (currentDashers || []).filter(dasher => dasher && dasher.userData)
    .flatMap(dasher => {
      const dasherOrders = allOrders.filter(order => order.dasherId === dasher.id && ['completed', 'cancelled_by_dasher'].includes(order.status));
      return dasherOrders.map(order => {
        const action = order.status === 'completed' ? 'completed' : 'cancelled';
        return {
            message: `(Dasher) ${dasher.userData.firstname || ''} ${dasher.userData.lastname || ''} has ${action} an order`,
            createdAt: order.createdAt
        };
      });
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const shopOrderMessages = currentShops.flatMap(shop => {
    const shopOrders = allOrders.filter(order => order.shopId === shop.id && order.status.includes('cancelled_by_shop'));
    return shopOrders.map(order => {
        return {
            message: `(Shop) ${shop.name} has cancelled an order`,
            createdAt: order.createdAt
        };
    });
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const allOrderMessages = [...userOrderMessages, ...dasherOrderMessages, ...shopOrderMessages].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const itemsPerPage = 4;
  const totalPages = Math.ceil(allOrderMessages.length / itemsPerPage);
  const indexedAllOrderMessages = allOrderMessages.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const handleNextPage = () => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  };

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  useEffect(() => {
    fetchAllOrdersShopsDashersUsers();
  }, []); // Include users in dependency array

  return (
    <div className="p-2 md:p-4 items-center justify-center w-full h-full flex flex-col gap-4 md:gap-6">
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 w-full'>
        <div className='flex flex-col w-full'>
          <div className='bg-white p-2 md:p-3 rounded-xl shadow-md mb-3'>
            <h2 className='text-base md:text-lg font-bold text-[#8B4513] text-center'>Orders Across Shops</h2>
            <p className='text-[#8B4513] text-xs text-center hidden sm:block'>Completed and cancelled order statistics</p>
          </div>
          <div className='w-full h-[350px] md:h-[400px] bg-white shadow-lg rounded-xl p-3 md:p-6 overflow-auto hover:shadow-xl transition-shadow duration-300'>
            {loading ? (
              <div className="flex justify-center items-center h-full w-full">
                <div className="flex flex-col items-center gap-4">
                  <div
                    className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                    role="status">
                    <span
                      className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                    >Loading...</span>
                  </div>
                  <p className="text-[#8B4513] font-semibold">Loading shop statistics...</p>
                </div>
              </div>
            ) : (
              <div className='flex flex-col w-full'>
                <div className='flex w-full items-center justify-between p-2 md:p-3 bg-[#FFFAF1] rounded-lg mb-2'>
                  <h2 className='font-bold text-[#8B4513] text-xs md:text-sm'>Shop Name</h2>
                  <h2 className='ml-4 md:ml-8 font-bold text-[#8B4513] text-xs md:text-sm'>Completed</h2>
                  <h2 className='font-bold text-[#8B4513] text-xs md:text-sm'>Cancelled</h2>
                </div>
                <div>
                  {shopStats.map((shop, index) => (
                    <div key={index} className="p-2 md:p-3 rounded-lg hover:bg-[#FFFAF1] transition-colors border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 md:gap-2 flex-1">
                          <div className='font-semibold text-[#8B4513] text-xs md:text-sm truncate'>{shop.shopName}</div>
                        </div>
                        <div className='text-base md:text-xl font-bold text-green-600 min-w-[50px] md:min-w-[80px] text-center'>{shop.completedOrders}</div>
                        <div className='text-base md:text-xl font-bold text-red-600 min-w-[50px] md:min-w-[80px] text-center'>{shop.cancelledOrders}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className='flex flex-col w-full'>
          <div className='bg-white p-2 md:p-3 rounded-xl shadow-md mb-3'>
            <h2 className='text-base md:text-lg font-bold text-[#8B4513] text-center'>Orders Across Users</h2>
            <p className='text-[#8B4513] text-xs text-center hidden sm:block'>User order completion statistics</p>
          </div>
          <div className='w-full h-[350px] md:h-[400px] bg-white shadow-lg rounded-xl p-3 md:p-6 overflow-auto hover:shadow-xl transition-shadow duration-300'>
            {loading ? (
              <div className="flex justify-center items-center h-full w-full">
                <div className="flex flex-col items-center gap-4">
                  <div
                    className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                    role="status">
                    <span
                      className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                    >Loading...</span>
                  </div>
                  <p className="text-[#8B4513] font-semibold">Loading user statistics...</p>
                </div>
              </div>
            ) : (
              <div className='flex flex-col w-full'>
                <div className='flex w-full items-center justify-between p-3 bg-[#FFFAF1] rounded-lg mb-2'>
                  <h2 className='font-bold text-[#8B4513]'>User Name</h2>
                  <h2 className='ml-8 font-bold text-[#8B4513]'>Completed</h2>
                  <h2 className='font-bold text-[#8B4513]'>Cancelled</h2>
                </div>
                <div>
                  {userStats.map((user, index) => (
                    <div key={index} className="p-3 rounded-lg hover:bg-[#FFFAF1] transition-colors border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <div className='font-semibold text-[#8B4513]'>{user.userName}</div>
                        </div>
                        <div className='text-xl font-bold text-green-600 min-w-[80px] text-center'>{user.completedOrders}</div>
                        <div className='text-xl font-bold text-red-600 min-w-[80px] text-center'>{user.cancelledOrders}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className='flex flex-col w-full'>
          <div className='bg-white p-2 md:p-3 rounded-xl shadow-md mb-3'>
            <h2 className='text-base md:text-lg font-bold text-[#8B4513] text-center'>Orders Across Dashers</h2>
            <p className='text-[#8B4513] text-xs text-center hidden sm:block'>Dasher performance metrics</p>
          </div>
          <div className='w-full h-[350px] md:h-[400px] bg-white shadow-lg rounded-xl p-3 md:p-6 overflow-auto hover:shadow-xl transition-shadow duration-300'>
            {loading ? (
              <div className="flex justify-center items-center h-full w-full">
                <div className="flex flex-col items-center gap-4">
                  <div
                    className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                    role="status">
                    <span
                      className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                    >Loading...</span>
                  </div>
                  <p className="text-[#8B4513] font-semibold">Loading dasher statistics...</p>
                </div>
              </div>
            ) : (
              <div className='flex flex-col w-full'>
                <div className='flex w-full items-center justify-between p-3 bg-[#FFFAF1] rounded-lg mb-2'>
                  <h2 className='font-bold text-[#8B4513]'>Dasher Name</h2>
                  <h2 className='ml-8 font-bold text-[#8B4513]'>Completed Orders</h2>
                </div>
                <div>
                  {dasherStats.map((dasher, index) => (
                    <div key={index} className="p-3 rounded-lg hover:bg-[#FFFAF1] transition-colors border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <div className='font-semibold text-[#8B4513]'>{dasher.dasherName}</div>
                        </div>
                        <div className='text-xl font-bold text-green-600 min-w-[120px] text-center'>{dasher.completedOrders}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className='bg-white p-3 md:p-4 rounded-xl shadow-md w-full mt-4'>
        <h2 className='text-lg md:text-2xl font-bold text-[#8B4513]'>Recent Activities</h2>
        <p className='text-[#8B4513] text-xs md:text-sm hidden sm:block'>Latest order actions across the platform</p>
      </div>
      <div className='w-full h-[350px] md:h-[400px] bg-white shadow-lg rounded-xl p-3 md:p-6 hover:shadow-xl transition-shadow duration-300 overflow-auto'>
        {loading ? (
          <div className="flex justify-center items-center h-full w-full">
            <div className="flex flex-col items-center gap-4">
              <div
                className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                role="status">
                <span
                  className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                >Loading...</span>
              </div>
              <p className="text-[#8B4513] font-semibold">Loading recent activities...</p>
            </div>
          </div>
        ) : (
          <div className='flex flex-col w-full'>
            <div>
              {indexedAllOrderMessages.map((message,index) => (
                <div key={index} className="p-2 md:p-4 rounded-lg hover:bg-[#FFFAF1] transition-colors border-b border-gray-100">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <div className='font-semibold text-[#8B4513] text-xs md:text-sm'>{message.message}</div>
                    </div>
                    <div className='text-xs md:text-sm text-[#8B4513] whitespace-nowrap'>{new Date(message.createdAt).toLocaleString('en-US', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric', 
                      hour: '2-digit', 
                      minute: '2-digit', 
                      second: '2-digit' 
                    })}</div>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <div className='flex mt-4 md:mt-7 items-center justify-center gap-2 md:gap-3'>
                <button 
                  onClick={handlePrevPage} 
                  disabled={page === 1} 
                  className="px-3 md:px-6 py-2 bg-[#BC4A4D] hover:bg-[#A03D40] text-white text-xs md:text-sm font-bold rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <div className='text-sm md:text-lg font-semibold text-[#8B4513] px-2 md:px-4'>
                  {page}/{totalPages}
                </div>
                <button 
                  onClick={handleNextPage} 
                  disabled={page === totalPages} 
                  className="px-3 md:px-6 py-2 bg-[#BC4A4D] hover:bg-[#A03D40] text-white text-xs md:text-sm font-bold rounded-lg shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ShopAnalytics = () => {
  const { orders: sharedOrders, shops: sharedShops, isLoading: sharedLoading } = useAdminData();
  // eslint-disable-next-line no-unused-vars
  const [cancelledOrders, setCancelledOrders] = useState(0);
  // eslint-disable-next-line no-unused-vars
  const [completedOrders, setCompletedOrders] = useState(0);
  // eslint-disable-next-line no-unused-vars
  const [pendingShops, setPendingShops] = useState([]);
  const [currentShops, setCurrentShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allOrders, setAllOrders] = useState([]);
  const [selectedYear, setSelectedYear] = useState(() => {
    const savedYear = sessionStorage.getItem('shopAnalyticsYear');
    return savedYear ? parseInt(savedYear) : 2025;
  });
  const [averageOrderValue, setAverageOrderValue] = useState(0);
  const [selectOptions, setSelectOptions] = useState("Top Performing Shops");
  // eslint-disable-next-line no-unused-vars
  const [mostOrdered, setMostOrdered] = useState([]);

  // Use shared data when available
  useEffect(() => {
    if (sharedOrders && sharedShops) {
      setAllOrders(sharedOrders);
      // Fetch top-performing shops separately as it needs specific calculation
      fetchTopShops();
      
      const completedOrdersList = sharedOrders.filter(order => order.status === 'completed');
      const cancelledByShop = sharedOrders.filter(order => order.status === 'cancelled_by_shop').length;
      const cancelledByCustomer = sharedOrders.filter(order => order.status === 'cancelled_by_customer').length;
      const cancelledByDasher = sharedOrders.filter(order => order.status === 'cancelled_by_dasher').length;
      const noShow = sharedOrders.filter(order => order.status === 'no-show').length;
      const totalOrders = completedOrdersList.length + cancelledByShop + cancelledByCustomer + cancelledByDasher + noShow;
      const completedPercentage = totalOrders ? (completedOrdersList.length / totalOrders) * 100 : 0;
      const cancelledPercentage = totalOrders ? ((cancelledByShop + cancelledByCustomer + cancelledByDasher + noShow) / totalOrders) * 100 : 0;
      const avgOrderValue = calculateAverageOrder(sharedOrders);

      setAverageOrderValue(avgOrderValue);
      setCompletedOrders(completedPercentage.toFixed(2));
      setCancelledOrders(cancelledPercentage.toFixed(2));
      setLoading(false);
    } else if (sharedLoading) {
      setLoading(true);
    }
  }, [sharedOrders, sharedShops, sharedLoading]);

  const fetchTopShops = async () => {
    try {
      const shopResponse = await axios.get('/shops/top-performing');
      const topShops = shopResponse.data;
      setCurrentShops(topShops);
    } catch (error) {
      console.error('Error fetching top shops:', error);
    }
  };

  const calculateAverageOrder = (orders) => {
    if (orders.length === 0) return "0.00";
    const totalValue = orders.reduce((acc, order) => acc + order.totalPrice, 0);
    const averageValue = totalValue / orders.length;
    return averageValue.toFixed(2);
  };

  const shopStats = currentShops.map(shop => {
    const shopOrders = allOrders.filter(order => order.shopId === shop.id);
    const completedOrders = shopOrders.filter(order => order.status === 'completed').length;
    const cancelledOrders = shopOrders.filter(order => order.status.includes('cancelled')).length;
    const totalRevenue = shopOrders.reduce((acc, order) => acc + order.totalPrice, 0);
    const averageOrderValue = shopOrders.length ? (totalRevenue / shopOrders.length).toFixed(2) : 0;

    return {
      shopName: shop.name,
      totalRevenue,
      completedOrders,
      cancelledOrders,
      averageOrderValue,
    };
  });

  // Remove the old useEffect that fetches orders - now using shared data
  // Only re-fetch top shops when year changes
  useEffect(() => {
    if (sharedOrders && sharedOrders.length > 0) {
      fetchTopShops();
    }
  }, [selectedYear]);

  const formatCompletedOrdersByMonth = (orders, selectedYear) => {
    const monthNames = [
      "Jan", "Feb", "March", "April", "May", "June",
      "July", "Aug", "Sept", "Oct", "Nov", "Dec"
    ];

    const ordersByMonth = {
      completed: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0, "11": 0, "12": 0 }
    };

    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const month = orderDate.getMonth() + 1;

      if (orderDate.getFullYear() === selectedYear) {
        if (["completed", "cancelled_by_customer", "cancelled_by_shop", "cancelled_by_dasher", "no-show"].includes(order.status)) {
          ordersByMonth.completed[month]++;
        }
      }
    });

    const xAxisData = monthNames; 
    const yAxisCompleted = Object.values(ordersByMonth.completed); 

    return { xAxisData, yAxisCompleted };
  };

  const { xAxisData, yAxisCompleted } = formatCompletedOrdersByMonth(allOrders, selectedYear);

  const handleOptionsChange = (event) => {
    setSelectOptions(event.target.value);
  };

  const handleYearChange = (event) => {
    const year = event.target.value;
    setSelectedYear(year);
    sessionStorage.setItem('shopAnalyticsYear', year);
  };

  return (
    <div className="p-2 md:p-4 items-center justify-center w-full h-full flex flex-col gap-4 md:gap-6">
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 w-full'>
        <div className='w-full h-[450px] md:h-[550px] bg-white shadow-lg rounded-xl p-3 md:p-4 overflow-auto hover:shadow-xl transition-shadow duration-300 lg:col-span-1'>
          <div className='flex w-full justify-between items-center mb-4'>
            <div className='flex flex-col w-full gap-3'>
              <div>
                <FormControl fullWidth>
                  <InputLabel id="various-select-label">Metric</InputLabel>
                  <Select
                    labelId="various-select-label"
                    id="various-select"
                    value={selectOptions}
                    label="Select..."
                    onChange={handleOptionsChange}
                  >
                    {['Top Performing Shops', 'Most Ordered Item'].map(option => (
                      <MenuItem key={option} value={option}>{option}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
              <div className='flex flex-row justify-between items-center mt-2'>
                <h2 className='font-bold text-[#8B4513] text-lg'>
                  {selectOptions === 'Top Performing Shops' ? 'Top Performing Shops' : 'Most Ordered Items'}
                </h2>
                <span className='font-semibold text-[#8B4513]'>{selectOptions === 'Top Performing Shops' ? 'Completed Orders' : 'Items Ordered'}</span>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center items-center h-full w-full">
              <div className="flex flex-col items-center gap-4">
                <div
                  className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                  role="status">
                  <span
                    className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                  >Loading...</span>
                </div>
                <p className="text-[#8B4513] font-semibold">Loading shop data...</p>
              </div>
            </div>
          ) : selectOptions === 'Top Performing Shops' ? (
            currentShops.map((shop, index) => (
              <div key={shop.id || index} className="p-3 rounded-lg hover:bg-[#FFFAF1] transition-colors border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className='font-bold text-[#BC4A4D]'>{index + 1}.</span> 
                    <img src={shop.imageUrl} alt="Shop profile" className="w-16 h-16 object-cover rounded-lg shadow-md border-2 border-gray-200" />
                    <div className='font-semibold text-[#8B4513]'>{shop.name}</div>
                  </div>
                  <div className='text-xl font-bold text-green-600'>{shop.completedOrderCount}</div>
                </div>
              </div>
            ))
          ) : (
            mostOrdered.map((item, index) => (
              <div key={index} className="adl-box p-2 rounded-lg overflow-auto">
                <div className="adl-box-content">
                  <div className="flex items-center gap-2 w-full">
                    <div className='w-[160px] p-2'>{item.name}</div>
                  </div>
                  <div>{item.shopName}</div>
                  <div>{item.count}</div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4 md:gap-6 w-full lg:col-span-1'>
          <div className='items-center justify-center flex flex-col bg-white w-full h-[200px] md:h-[262px] shadow-lg rounded-xl p-4 md:p-6 hover:shadow-xl transition-shadow duration-300'>
            <h2 className='text-xl font-bold self-start mb-2 text-[#8B4513]'>Total Handled Orders</h2> 
            {loading ? (
              <div className="flex justify-center items-center h-full w-full">
                <div className="flex flex-col items-center gap-4">
                  <div
                    className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                    role="status">
                    <span
                      className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                    >Loading...</span>
                  </div>
                </div>
              </div>
            ) : <div className='h-full text-[96px] font-bold text-[#BC4A4D]'>{allOrders.length}</div>}
          </div>
          <div className='items-center justify-center flex flex-col bg-white w-full h-[262px] shadow-lg rounded-xl p-6 hover:shadow-xl transition-shadow duration-300'>
            <h2 className='text-xl font-bold self-start mb-2 text-[#8B4513]'>Avg. Order Value</h2> 
            {loading ? (
              <div className="flex justify-center items-center h-full w-full">
                <div className="flex flex-col items-center gap-4">
                  <div
                    className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                    role="status">
                    <span
                      className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                    >Loading...</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className='h-full text-[72px] items-center justify-center flex flex-col font-bold text-[#BC4A4D]'>
                <div>₱{averageOrderValue}</div>
              </div>
            )}
          </div>
        </div>
        <div className='w-full h-[450px] md:h-[550px] bg-white hover:shadow-xl transition-shadow duration-300 shadow-lg rounded-xl p-3 md:p-4 flex flex-col items-center justify-start overflow-auto lg:col-span-1'>
          <div className='flex items-center justify-between w-full mb-2'>
            <h2 className='font-bold text-xl text-[#8B4513]'>Orders Overtime</h2>
            <div className='w-[100px]'>
              <FormControl fullWidth>
                <InputLabel id="year-select-label">Year</InputLabel>
                <Select
                  labelId="year-select-label"
                  id="year-select"
                  value={selectedYear}
                  label="year"
                  onChange={handleYearChange}
                >
                  {[2023, 2024, 2025, 2026, 2027, 2028].map(year => (
                    <MenuItem key={year} value={year}>{year}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center items-center h-full w-full">
              <div className="flex flex-col items-center gap-4">
                <div
                  className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                  role="status">
                  <span
                    className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                  >Loading...</span>
                </div>
                <p className="text-[#8B4513] font-semibold text-sm">Loading chart...</p>
              </div>
            </div>
          ): (  
            <LineChart
              xAxis={[{ data: xAxisData, label:'Month',scaleType: 'band' }]}
              series={[
                {
                  data: yAxisCompleted, 
                  label: 'Handled Orders',
                  color: 'green',
                },
              ]}
              width={380}
              height={420}
            />
          )}
        </div>
      </div>
      <div className='w-full flex flex-col items-center mt-4 md:mt-6'>
        <div className='bg-white p-3 md:p-4 rounded-xl shadow-md w-full mb-3'>
          <h2 className='font-bold text-base md:text-xl text-[#8B4513]'>Shop Performance Summary</h2>
          <p className='text-[#8B4513] text-xs md:text-sm hidden sm:block'>Detailed metrics for all shops</p>
        </div>
        <div className='w-full bg-white rounded-xl shadow-lg overflow-x-auto'>
          <table className="w-full min-w-[640px]">
            <thead className='bg-[#BC4A4D]'>
              <tr className='text-white'>
                <th className="px-7 py-3 text-left font-bold">Shop Name</th>
                <th className="px-6 py-3 text-center font-bold">Total Revenue</th>
                <th className="px-2 py-3 text-center font-bold">Completed</th>
                <th className="py-3 pr-1 text-center font-bold">Cancelled</th>
                <th className="px-2 py-3 pl-1 text-center font-bold">Avg. Value</th>
              </tr>
            </thead>
          </table>
        </div>
      </div>
      <div className='w-full h-[200px] bg-white hover:shadow-xl transition-shadow duration-300 shadow-lg rounded-xl p-4 overflow-auto'>
        {loading ? (
          <div className="flex justify-center items-center h-full w-full">
            <div className="flex flex-col items-center gap-4">
              <div
                className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                role="status">
                <span
                  className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                >Loading...</span>
              </div>
              <p className="text-[#8B4513] font-semibold">Loading shop performance...</p>
            </div>
          </div>
        ) : shopStats.map((shop, index) => (
          <div key={index} className="p-2 md:p-4 rounded-lg hover:bg-[#FFFAF1] transition-colors border-b border-gray-100">
            <div className="grid grid-cols-5 gap-2 md:gap-4 items-center">
              <div className="font-bold text-[#8B4513] text-sm md:text-lg truncate">{shop.shopName}</div>
              <div className='text-sm md:text-xl font-semibold text-green-600 text-center'>₱{shop.totalRevenue}</div>
              <div className='text-sm md:text-xl font-semibold text-[#8B4513] text-center'>{shop.completedOrders}</div>
              <div className='text-sm md:text-xl font-semibold text-red-600 text-center'>{shop.cancelledOrders}</div>
              <div className='text-sm md:text-xl font-semibold text-[#BC4A4D] text-center'>₱{shop.averageOrderValue}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const DashersAnalytics = () => {
  const { orders: sharedOrders, dashers: sharedDashers, isLoading: sharedLoading } = useAdminData();
  const [currentDashers, setCurrentDashers] = useState([]);
  const [allDashers, setAllDashers] = useState([]);
  const [cancelledOrders, setCancelledOrders] = useState(0);
  const [completedOrders, setCompletedOrders] = useState(0);
  const [loading, setLoading] = useState(false);
  const [allOrders, setAllOrders] = useState([]);
  const [selectedYear, setSelectedYear] = useState(() => {
    const savedYear = sessionStorage.getItem('dasherAnalyticsYear');
    return savedYear ? parseInt(savedYear, 10) : 2025;
  });

  // Use shared data when available
  useEffect(() => {
    if (sharedOrders && sharedDashers) {
      setAllOrders(sharedOrders);
      
      const maonani = sharedOrders.filter(order => order.status === 'completed');
      const dasherOrderCounts = maonani.reduce((acc, order) => {
        const dasherId = order.dasherId;
        if(!acc[dasherId]){
          acc[dasherId] = 0;
        }
        acc[dasherId]++;
        return acc;
      }, {});
      
      const completedOrdersList = sharedOrders.filter(order => order.status === 'completed').length;
      const cancelledByShop = sharedOrders.filter(order => order.status === 'cancelled_by_shop').length;
      const cancelledByCustomer = sharedOrders.filter(order => order.status === 'cancelled_by_customer').length;
      const cancelledByDasher = sharedOrders.filter(order => order.status === 'cancelled_by_dasher').length;
      const totalOrders = completedOrdersList + cancelledByShop + cancelledByCustomer + cancelledByDasher;
      
      const completedPercentage = totalOrders ? (completedOrdersList / totalOrders) * 100 : 0;
      const cancelledPercentage = totalOrders ? ((cancelledByShop + cancelledByCustomer + cancelledByDasher) / totalOrders) * 100 : 0;
      
      setCompletedOrders(completedPercentage.toFixed(2));
      setCancelledOrders(cancelledPercentage.toFixed(2));
      
      setAllDashers(sharedDashers.all);
      setCurrentDashers(
        sharedDashers.active.map((dasher) => ({
          ...dasher,
          completedOrders: dasherOrderCounts[dasher.id] || 0,
        })).sort((a, b) => b.completedOrders - a.completedOrders)
      );
      
      setLoading(false);
    } else if (sharedLoading) {
      setLoading(true);
    }
  }, [sharedOrders, sharedDashers, sharedLoading]);

  const fetchDashers = async () => {
    // Data now comes from shared context
  };

  const fetchOrders = async () => {
    // Data now comes from shared context
  };

  useEffect(() => {
    // Data loaded from shared context
  }, [selectedYear]);

  const formatCompletedOrdersByMonth = (orders, selectedYear) => {
    const monthNames = [
      "Jan", "Feb", "March", "April", "May", "June",
      "July", "Aug", "Sept", "Oct", "Nov", "Dec"
    ];

    const ordersByMonth = {
      completed: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0, "11": 0, "12": 0 },
      cancelled: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "10": 0, "11": 0, "12": 0 }
    };

    orders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const month = orderDate.getMonth() + 1;

      if (orderDate.getFullYear() === selectedYear) {
        if (order.status === "completed") {
          ordersByMonth.completed[month]++;
        }
        else if (["cancelled_by_customer", "cancelled_by_shop", "cancelled_by_dasher"].includes(order.status)) {
          ordersByMonth.cancelled[month]++;
        }
      }
    });

    const xAxisData = monthNames; 
    const yAxisCompleted = Object.values(ordersByMonth.completed); 
    const yAxisCancelled = Object.values(ordersByMonth.cancelled); 

    return { xAxisData, yAxisCompleted, yAxisCancelled };
  };

  const { xAxisData, yAxisCompleted, yAxisCancelled } = formatCompletedOrdersByMonth(allOrders, selectedYear);

  const sampleData = [
    {
      value: completedOrders,
      color: 'green',
    },
    {
      value: cancelledOrders,
      color: 'red',
    },
  ];

  const valueFormatter = (item) => `${item.value}%`;

  const handleYearChange = (event) => {
    const newYear = event.target.value;
    setSelectedYear(newYear);
    sessionStorage.setItem('dasherAnalyticsYear', newYear);
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchDashers();
      await fetchOrders();
    };
    fetchData();
  }, []);

  return (
    <div className="p-2 md:p-4 items-center justify-center w-full h-full flex flex-col gap-4 md:gap-6">
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 w-full'>
        <div className='w-full h-[450px] md:h-[550px] bg-white shadow-lg rounded-xl p-3 md:p-4 overflow-auto hover:shadow-xl transition-shadow duration-300 lg:col-span-1'>
          <div className='flex w-full justify-between items-center mb-4 pb-3 border-b-2 border-[#FFFAF1]'>
            <h2 className='font-bold text-[#8B4513] text-lg'>Top Dashers</h2>
            <h2 className='font-bold text-[#8B4513]'>Completed</h2>
          </div>
          {loading ? (
            <div className="flex justify-center items-center h-full w-full">
              <div className="flex flex-col items-center gap-4">
                <div
                  className="inline-block h-16 w-16 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                  role="status">
                  <span
                    className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                  >Loading...</span>
                </div>
                <p className="text-[#8B4513] font-semibold">Loading dashers...</p>
              </div>
            </div>
          ) : (currentDashers || []).filter(dasher => dasher && dasher.userData).map((dasher, index) => (
            <div key={dasher.id} className="p-3 rounded-lg hover:bg-[#FFFAF1] transition-colors border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className='font-bold text-[#BC4A4D]'>{index + 1}.</span> 
                  <img src={dasher.schoolId} alt="School ID" className="w-12 h-12 object-cover rounded-lg shadow-md border-2 border-gray-200" />
                  <div className='font-semibold text-[#8B4513]'>
                    {dasher.userData.firstname ? 
                      `${dasher.userData.firstname} ${dasher.userData.lastname || ''}` : 
                      'Unknown User'}
                  </div>
                </div>
                <div className='text-xl font-bold text-green-600'>{dasher.completedOrders}</div>
              </div>
            </div>
          ))}
        </div>
        <div className='w-full lg:col-span-1'>
          <div className='items-center justify-center flex flex-col bg-white w-full h-[450px] md:h-[550px] shadow-lg rounded-xl p-4 md:p-6 hover:shadow-xl transition-shadow duration-300 overflow-hidden'>
            <h2 className='text-xl font-bold self-start mb-2 text-[#8B4513]'>Completed vs Cancelled</h2> 
            <div className='self-end flex-col flex items-start mb-3'>
              <div className='flex flex-row items-center justify-center gap-2'>
                <div className='rounded-full bg-green-700 w-3 h-3'></div>
                <div className='text-sm text-[#8B4513] font-semibold'>Completed Orders</div>
              </div>
              <div className='flex flex-row items-center justify-center gap-2'>
                <div className='rounded-full bg-red-700 w-3 h-3'></div>
                <div className='text-sm text-[#8B4513] font-semibold'>Cancelled Orders</div>
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center items-center h-full w-full">
                <div className="flex flex-col items-center gap-4">
                  <div
                    className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                    role="status">
                    <span
                      className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                    >Loading...</span>
                  </div>
                  <p className="text-[#8B4513] font-semibold text-sm">Loading chart...</p>
                </div>
              </div>
            ) : (
              <div className='flex items-center justify-center w-full h-full'>
                <PieChart
                  series={[
                    {
                      data: sampleData,
                      faded: { innerRadius: 20, additionalRadius: -20, color: 'gray' },
                      highlightScope: { fade: 'global', highlight: 'item' },
                      arcLabel: 'value',
                      valueFormatter,
                    },
                  ]}
                  height={320}
                  width={320}
                />
              </div>
            )}
          </div>
        </div>
        <div className='w-full h-[450px] md:h-[550px] bg-white hover:shadow-xl transition-shadow duration-300 shadow-lg rounded-xl p-3 md:p-4 flex flex-col items-center justify-start overflow-auto lg:col-span-1'>
          <div className='flex items-center justify-between w-full mb-2'>
            <h2 className='font-bold text-xl text-[#8B4513]'>Orders Overtime</h2>
            <div className='w-[100px]'>
              <FormControl fullWidth>
                <InputLabel id="year-select-label">Year</InputLabel>
                <Select
                  labelId="year-select-label"
                  id="year-select"
                  value={selectedYear}
                  label="year"
                  onChange={handleYearChange}
                >
                  {[2023, 2024, 2025, 2026, 2027, 2028].map(year => (
                    <MenuItem key={year} value={year}>{year}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center items-center h-full w-full">
              <div className="flex flex-col items-center gap-4">
                <div
                  className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                  role="status">
                  <span
                    className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                  >Loading...</span>
                </div>
                <p className="text-[#8B4513] font-semibold text-sm">Loading chart...</p>
              </div>
            </div>
          ) : (
            <LineChart
              xAxis={[{ data: xAxisData, label:'Month',scaleType: 'band' }]}
              series={[
                {
                  data: yAxisCompleted, 
                  label: 'Completed Orders',
                  color: 'green',
                },
                {
                  data: yAxisCancelled, 
                  label: 'Cancelled Orders',
                  color: 'red',
                },
              ]}
              width={380}
              height={400}
            />
          )}
        </div>
      </div>
      <div className='w-full flex flex-col items-center mt-4 md:mt-6'>
        <div className='bg-white p-3 md:p-4 rounded-xl shadow-md w-full mb-3'>
          <h2 className='font-bold text-base md:text-xl text-[#8B4513]'>Dasher Availability Schedule</h2>
          <p className='text-[#8B4513] text-xs md:text-sm hidden sm:block'>Weekly availability status for all dashers</p>
        </div>
        <div className='w-full bg-white rounded-xl shadow-lg overflow-x-auto'>
          <table className="w-full min-w-[800px]">
            <thead className='bg-[#BC4A4D]'>
              <tr className='text-white'>
                <th className="px-7 py-3 text-left font-bold">Dasher</th>
                <th className="px-6 py-3 text-center font-bold">Monday</th>
                <th className="px-2 py-3 text-center font-bold">Tuesday</th>
                <th className="py-3 pr-1 text-center font-bold">Wednesday</th>
                <th className="px-2 py-3 pl-1 text-center font-bold">Thursday</th>
                <th className="px-4 py-3 pl-2 text-center font-bold">Friday</th>
                <th className="px-4 py-3 pr-2 text-center font-bold">Saturday</th>
                <th className="px-4 py-3 pr-6 pl-3 text-center font-bold">Sunday</th>
              </tr>
            </thead>
          </table>
        </div>
      </div>
      <div className='w-full h-[200px] bg-white hover:shadow-xl transition-shadow duration-300 shadow-lg rounded-xl p-4 overflow-auto self-end'>
        <div className='flex flex-col w-full'>
          <div className="overflow-x-auto">
            <table className="table-auto w-full">
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" className="text-center py-8">
                      <div className="flex justify-center items-center h-full w-full">
                        <div className="flex flex-col items-center gap-4">
                          <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-[#BC4A4D] border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                              className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                          </div>
                          <p className="text-[#8B4513] font-semibold">Loading availability...</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  (allDashers || []).filter(dasher => dasher && dasher.userData).map(dasher => (
                    <tr key={dasher.id} className='hover:bg-[#FFFAF1] transition-colors'>
                      <td className="px-4 py-3 text-left font-semibold text-[#8B4513]"> 
                        {dasher.userData.firstname ? 
                          `${dasher.userData.firstname} ${dasher.userData.lastname || ''}` : 
                          'Unknown User'}
                      </td>
                      <td className={`px-4 py-3 text-center font-semibold ${dasher.daysAvailable.includes('MON') ? 'text-green-600' : 'text-gray-400'}`}>
                        {dasher.daysAvailable.includes('MON') ? '✓ Available' : '✗ Unavailable'}
                      </td>
                      <td className={`px-4 py-3 text-center font-semibold ${dasher.daysAvailable.includes('TUE') ? 'text-green-600' : 'text-gray-400'}`}>
                        {dasher.daysAvailable.includes('TUE') ? '✓ Available' : '✗ Unavailable'}
                      </td>
                      <td className={`px-4 py-3 text-center font-semibold ${dasher.daysAvailable.includes('WED') ? 'text-green-600' : 'text-gray-400'}`}>
                        {dasher.daysAvailable.includes('WED') ? '✓ Available' : '✗ Unavailable'}
                      </td>
                      <td className={`px-4 py-3 text-center font-semibold ${dasher.daysAvailable.includes('THU') ? 'text-green-600' : 'text-gray-400'}`}>
                        {dasher.daysAvailable.includes('THU') ? '✓ Available' : '✗ Unavailable'}
                      </td>
                      <td className={`px-4 py-3 text-center font-semibold ${dasher.daysAvailable.includes('FRI') ? 'text-green-600' : 'text-gray-400'}`}>
                        {dasher.daysAvailable.includes('FRI') ? '✓ Available' : '✗ Unavailable'}
                      </td>
                      <td className={`px-4 py-3 text-center font-semibold ${dasher.daysAvailable.includes('SAT') ? 'text-green-600' : 'text-gray-400'}`}>
                        {dasher.daysAvailable.includes('SAT') ? '✓ Available' : '✗ Unavailable'}
                      </td>
                      <td className={`px-4 py-3 text-center font-semibold ${dasher.daysAvailable.includes('SUN') ? 'text-green-600' : 'text-gray-400'}`}>
                        {dasher.daysAvailable.includes('SUN') ? '✓ Available' : '✗ Unavailable'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminAnalytics = () => {
  const [value, setValue] = useState(() => {
    return sessionStorage.getItem('adminAnalyticsTab') || '2';
  });
  const changeValue = (event, newValue) => { 
    setValue(newValue);
    sessionStorage.setItem('adminAnalyticsTab', newValue);
  };
  const color = red[400];

  return (
    <AdminDataProvider>
      <div className="min-h-screen pt-[70px] pr-4 md:pr-8 lg:pr-[50px] pb-8 md:pb-[50px] pl-4 md:pl-20 lg:pl-[120px] flex flex-col items-start">
        <TabContext value={value}>
          <div className="w-full h-12 border rounded-t-lg bg-[#BC4A4D] text-white font-semibold">
            <Tabs
              value={value}
              onChange={changeValue}
              aria-label="wrapped label tabs example"
              textColor='inherit'
              sx={{
                '& .MuiTabs-indicator': {
                  backgroundColor: color, // Custom color for the indicator
                },
              }}
              centered
              variant='fullWidth'
            >
              <Tab value="2" label="Overall" sx={{fontWeight:'bold'}} />
              <Tab value="3" label="Dashers" sx={{fontWeight:'bold'}} />
              <Tab value="4" label="Shop" sx={{fontWeight:'bold'}} />
            </Tabs>
          </div>
          <div className="w-full rounded-b-lg border bg-[#FFFAF1] overflow-auto">
            <TabPanel value="2">
              <OverAllAnalytics/>
            </TabPanel>
            <TabPanel value="3">
              <DashersAnalytics/>
            </TabPanel>
            <TabPanel value="4">
              <ShopAnalytics/>
            </TabPanel>
          </div>
        </TabContext>
      </div>
    </AdminDataProvider>
  );
};

export default AdminAnalytics;