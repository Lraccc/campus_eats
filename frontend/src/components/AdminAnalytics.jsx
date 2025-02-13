import TabContext from '@mui/lab/TabContext';
import TabPanel from '@mui/lab/TabPanel';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { red } from '@mui/material/colors';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { LineChart } from '@mui/x-charts/LineChart';
import { PieChart } from '@mui/x-charts/PieChart';

import { useEffect, useState } from 'react';
import axios from "../utils/axiosConfig";



const OverAllAnalytics = () => {

  const [allOrders, setAllOrders] = useState([]);
  const [pendingShops, setPendingShops] = useState([]);
  const [currentShops, setCurrentShops] = useState([]);
  const [allDashers, setAllDashers] = useState([]);
  const [currentDashers, setCurrentDashers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [page,setPage] = useState(1);
 



  const fetchAllOrdersShopsDashersUsers = async () => {
    try{
      setLoading(true);
       const orderResponse = await axios.get('/orders/completed-orders')
            const allOrders = orderResponse.data.completedOrders;
                setAllOrders(allOrders);
       const shopResponse = await axios.get('/shops/pending-lists');
                const { pendingShops, nonPendingShops } = shopResponse.data;
                const filteredShops = nonPendingShops.filter(shop => shop.status === 'active');
                setPendingShops(pendingShops);
                setCurrentShops(filteredShops);
        const dasherResponse = await axios.get('/dashers/pending-lists');
                const pendingDashersHold = dasherResponse.data.pendingDashers;
                const currentDashersHold = dasherResponse.data.nonPendingDashers;
                const pendingDashersData = await Promise.all(
                    pendingDashersHold.map(async (dasher) => {
                        const pendingDashersDataResponse = await axios.get(`/users/${dasher.id}`);
                        const pendingDashersData = pendingDashersDataResponse.data;
                        return { ...dasher, userData: pendingDashersData };
                    })
                );
        const currentDashersData = await Promise.all(
                    currentDashersHold.map(async (dasher) => {
                        const currentDashersDataResponse = await axios.get(`/users/${dasher.id}`);
                        const currentDashersData = currentDashersDataResponse.data;
                        return { ...dasher, userData: currentDashersData };
                    })
                );
                const realDashers = currentDashersData.filter((dasher) => dasher.status === "active" || dasher.status === "offline");
                setAllDashers(currentDashersData);
                setCurrentDashers(realDashers);

        const userResponse = await axios.get('/users');
        const allUsers = userResponse.data;
        setUsers(allUsers);

    }catch(error){
      console.error('Error fetching everything:', error.response.data.error);

  }finally{
    setLoading(false);
  }
}


const userStats = users.map(user => {
    const userOrders = allOrders.filter(order => order.uid === user.id);
    const completedOrders = userOrders.filter(order => order.status === 'completed').length;
  const cancelledOrders = userOrders.filter(order => order.status.includes('cancelled_by_customer')).length;
  const totalOrders = completedOrders + cancelledOrders


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
          const totalOrders = completedOrders + cancelledOrders

        return{ 
          shopName: shop.name,
          completedOrders,
          cancelledOrders,
          totalOrders
        }
    
}).sort((a, b) => b.totalOrders - a.totalOrders);

const dasherStats = currentDashers.map(dasher => {
  const dasherOrders = allOrders.filter(order => order.dasherId === dasher.id);
  const completedOrders = dasherOrders.filter(order => order.status === 'completed').length;
  const cancelledOrders = dasherOrders.filter(order => order.status.includes('cancelled_by_dasher')).length;
  const totalOrders = completedOrders + cancelledOrders

  return {
    dasherName: `${dasher.userData.firstname} ${dasher.userData.lastname}`,
    completedOrders,
    cancelledOrders,
    totalOrders
  }
}).sort((a, b) => b.totalOrders - a.totalOrders);



const userOrderMessages = users.flatMap(user => {
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

const dasherOrderMessages = currentDashers.flatMap(dasher => {
    const dasherOrders = allOrders.filter(order => order.dasherId === dasher.id && ['completed', 'cancelled_by_dasher'].includes(order.status));
    return dasherOrders.map(order => {
        const action = order.status === 'completed' ? 'completed' : 'cancelled';
        return {
            message: `(Dasher) ${dasher.userData.firstname} ${dasher.userData.lastname} has ${action} an order`,
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
}, []);

 return(
  <div className="p-1 items-center justify-center w-full h-full flex flex-col gap-2">
     <div className='flex items-center justify-center w-full gap-8'>
      <div className='flex flex-col'>
        <h2 className='self-center font-semibold'>Total Completed and Cancelled Orders across Shops</h2>
              <div className=' w-[550px] h-[400px] shadow-2xl rounded-2xl p-4 overflow-auto hover:scale-[1.01] transition-transform duration-300'>
                {loading ? (<div className="flex justify-center items-center h-full w-full">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>) : <div className='flex flex-col w-full'>
                      <div className='flex w-full items-center justify-between p-2'>
                        <h2>Shop Name</h2>
                        <h2 className='ml-8'>Completed Orders</h2>
                        <h2>Cancelled Orders</h2>
                        </div>
                    <div>
                    {shopStats.map((shop) => (
                      <div key={shop.id} className="adl-box p-2 rounded-lg overflow-auto">
                    <div className="adl-box-content items-center">
                 <div className="flex items-center gap-2 justify-center">
                <div className='font-semibold'>{shop.shopName}</div>
              </div>
              <div className='text-2xl'>{shop.completedOrders}</div>
              <div className='text-2xl'>{shop.cancelledOrders}</div>
            </div>
          </div>
        ))}
        </div>
        </div>
        }

  </div>
  </div>
  <div className='flex flex-col'>
        <h2 className='self-center font-semibold'>Total Completed and Cancelled Orders across Users</h2>
              <div className=' w-[550px] h-[400px] shadow-2xl rounded-2xl p-4 overflow-auto hover:scale-[1.01] transition-transform duration-300'>
  {loading ? (<div className="flex justify-center items-center h-full w-full">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>) : <div className='flex flex-col w-full'>
                      <div className='flex w-full items-center justify-between p-2'>
                        <h2>User Name</h2>
                        <h2 className='ml-8'>Completed Orders</h2>
                        <h2>Cancelled Orders</h2>
                        </div>
                    <div>
                    {userStats.map((user) => (
                      <div key={user.id} className="adl-box p-2 rounded-lg overflow-auto">
                    <div className="adl-box-content items-center">
                 <div className="flex items-center gap-2 justify-center">
                <div className='font-semibold'>{user.userName}</div>
              </div>
              <div className='text-2xl'>{user.completedOrders}</div>
              <div className='text-2xl'>{user.cancelledOrders}</div>
            </div>
          </div>
        ))}
        </div>
        </div>
        }
  
  </div>
  </div>
 <div className='flex flex-col'>
        <h2 className='self-center font-semibold'>Total Completed Orders across Dashers</h2>
              <div className=' w-[550px] h-[400px] shadow-2xl rounded-2xl p-4 overflow-auto hover:scale-[1.01] transition-transform duration-300'>
    {loading ? (<div className="flex justify-center items-center h-full w-full">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>) : <div className='flex flex-col w-full'>
                      <div className='flex w-full items-center justify-between p-2'>
                        <h2>Dasher Name</h2>
                        <h2 className='ml-8'>Completed Orders</h2>
                        </div>
                    <div>
                    {dasherStats.map((dasher) => (
                      <div key={dasher.id} className="adl-box p-2 rounded-lg overflow-auto">
                    <div className="adl-box-content items-center">
                 <div className="flex items-center gap-2 justify-center">
                <div className='font-semibold'>{dasher.dasherName}</div>
              </div>
              <div className='text-2xl'>{dasher.completedOrders}</div>
            </div>
          </div>
        ))}
        </div>
        </div>
        }
  
  </div>
  </div>
    </div>
    <div className='text-2xl font-semibold'>
      Recent Activities
    </div>
    <div className=' w-[1000px] h-[350px] shadow-2xl rounded-2xl p-4 hover:scale-[1.01] transition-transform duration-300'>
  {loading ? (<div className="flex justify-center items-center h-full w-full">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>) : <div className='flex flex-col w-full'>
                    <div>
                    {indexedAllOrderMessages.map((message,index) => (
                      <div key={index} className="adl-box p-2 rounded-lg overflow-auto">
                    <div className="adl-box-content items-center">
                 <div className="flex items-center gap-2 justify-center">
                <div className='font-semibold'>{message.message}</div>
              </div>
          <div className='text-lg'>{new Date(message.createdAt).toLocaleString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric', 
                                hour: '2-digit', 
                                minute: '2-digit', 
                                second: '2-digit' 
                            })}</div>            </div>
          </div>
        ))}
        </div>
        <div>
          <div className='flex mt-7 items-center justify-center gap-2'>
            <button onClick={handlePrevPage} disabled={page === 1} class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">
           Prev 
            </button>
            <div className='text-lg'>
              {page}
              </div>
            <button onClick={handleNextPage} disabled={page === totalPages}class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-full">
           Next 
            </button>
            </div>
          </div>

        </div>
        }
    </div>
    </div>
 )


}



const ShopAnalytics = () => {
    const [cancelledOrders, setCancelledOrders] = useState(0);
    const[completedOrders, setCompletedOrders] = useState(0);
    const [pendingShops, setPendingShops] = useState([]);
    const [currentShops, setCurrentShops] = useState([]);
    const [loading, setLoading] = useState(false);
    const[allOrders, setAllOrders] = useState([]);
    const [selectedYear,setSelectedYear] = useState(2024)
    const [averageOrderValue, setAverageOrderValue] = useState(0);
    const [selectOptions, setSelectOptions] = useState("Top Performing Shops")
    const [mostOrdered, setMostOrdered] = useState([])
 

    //  const fetchShops = async () => {
    //         setLoading(true);
    //         try {
               
    //         } catch (error) {
    //             console.error('Error fetching shops:', error);
    //         }finally {
    //             setLoading(false);
    //         }
    //     };


    const calculateAverageOrder = (orders) => {
      const totalValue = orders.reduce((acc, order) => acc + order.totalPrice, 0);
      const averageValue = totalValue / orders.length;

      return averageValue.toFixed(2);

    }

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
        

      const fetchOrders = async () => {
        setLoading(true);
        try {
            const orderResponse = await axios.get('/orders/completed-orders');
            const allOrders = orderResponse.data.completedOrders;
            setAllOrders(allOrders);
    
            // Fetch top-performing shops from the backend
            const shopResponse = await axios.get('/shops/top-performing');
            const topShops = shopResponse.data;
            console.log("GAY: ",topShops);  
    
            // Update state with the fetched shops
            setCurrentShops(topShops);
    
            const completedOrders = allOrders.filter(order => order.status === 'completed').length;
            const cancelledByShop = allOrders.filter(order => order.status === 'cancelled_by_shop').length;
            const cancelledByCustomer = allOrders.filter(order => order.status === 'cancelled_by_customer').length;
            const cancelledByDasher = allOrders.filter(order => order.status === 'cancelled_by_dasher').length;
            const noShow = allOrders.filter(order => order.status === 'no-show').length;
            const totalOrders = completedOrders + cancelledByShop + cancelledByCustomer + cancelledByDasher + noShow;
            const completedPercentage = (completedOrders / totalOrders) * 100;
            const cancelledPercentage = ((cancelledByShop + cancelledByCustomer + cancelledByDasher + noShow) / totalOrders) * 100;
            const averageOrderValue = calculateAverageOrder(allOrders);
    
            setAverageOrderValue(averageOrderValue);
            setCompletedOrders(completedPercentage.toFixed(2));
            setCancelledOrders(cancelledPercentage.toFixed(2));
    
            // The rest of your logic
        } catch (error) {
            console.error('Error fetching orders:', error.response.data.error);
        } finally {
            setLoading(false);
        }
    };
    
    



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
     if (["completed","cancelled_by_customer", "cancelled_by_shop", "cancelled_by_dasher","no-show"].includes(order.status)) {
        ordersByMonth.completed[month]++;
      }
    }
  });


  const xAxisData = monthNames; 
  const yAxisCompleted = Object.values(ordersByMonth.completed); 

  return { xAxisData, yAxisCompleted };
};


const { xAxisData, yAxisCompleted } = formatCompletedOrdersByMonth(allOrders,selectedYear);


const handleOptionsChange = (event) => {
  setSelectOptions(event.target.value);
}


const handleYearChange = (event) => {
    setSelectedYear(event.target.value);
  };

     useEffect(() => {
  // const fetchData = async () => {
  //   await fetchShops();
  //   await fetchOrders();
  // };
  fetchOrders();
  console.log(shopStats)

}, []);


  return (
    <div className="p-1 items-center justify-center w-full h-full flex flex-col gap-2">
      <div className='flex items-center justify-between w-full gap-8'>
        <div className=' w-[500px] h-[550px] shadow-2xl rounded-2xl p-4 overflow-auto hover:scale-[1.01] transition-transform duration-300'>
        <div className='flex w-full justify-between items-center'>
          <div className='flex flex-col w-full'>
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
            <div className='flex flex-row justify-between items-center'>
    <h2 className='font-semibold'>
      {selectOptions === 'Top Performing Shops' ? 'Top Performing Shops' : 'Most Ordered Items'}
    </h2>
    {selectOptions === 'Top Performing Shops' ? 'Completed Orders' : 'Items Ordered'}
  </div>
            </div>
        </div>
     {loading ? (
    <div className="flex justify-center items-center h-full w-full">
      <div
        className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
        role="status">
        <span
          className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
        >Loading...</span>
      </div>
    </div>
  ) : selectOptions === 'Top Performing Shops' ? (
    currentShops.map((shop, index) => (
      <div key={shop.id} className="adl-box p-2 rounded-lg overflow-auto">
        <div className="adl-box-content">
          <div className="flex items-center gap-2">
            <span>{index + 1}.</span> 
            <img src={shop.imageUrl} alt="Shop profile" className="w-16 h-16" />
          </div>
          <div className='w-5'>{shop.name}</div>
          <div>{shop.completedOrderCount}</div>
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
         <div className='flex flex-col gap-8'>
            <div className='items-center justify-center flex flex-col border  w-[300px] h-[250px] shadow-2xl rounded-2xl p-4 hover:scale-[1.02] transition-transform duration-300'>
           <h2 className='text-xl font-semibold self-start '>Total Handled Orders</h2> 
           {loading ? (<div className="flex justify-center items-center h-full w-full">
                        <div
                            className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>) : <div className='h-full text-[128px]'>{allOrders.length}</div>}
        
        </div>
           <div className='items-center justify-center flex flex-col border  w-[300px] h-[250px] shadow-2xl rounded-2xl p-4 hover:scale-[1.02] transition-transform duration-300'>
           <h2 className='text-lg font-semibold self-start '>All Shops Avg. Order Value</h2> 
           {loading ? (<div className="flex justify-center items-center h-full w-full">
                        <div
                            className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>) : <div className='h-full text-[84px] items-center justify-center flex flex-col'>
                      <div>{averageOrderValue}₱</div>
                      </div>}
        
        </div>
        </div>
        <div className=' w-[800px] h-[500px] hover:scale-[1.01] transition-transform duration-300 shadow-2xl rounded-2xl p-4 flex flex-col items-center justify-center'>
        <div className='flex items-center justify-between w-full'>
            <h2 className='font-semibold'>Orders Overtime</h2>
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
            {  loading ? (<div className="flex justify-center items-center h-full w-full">
                        <div
                            className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>):  
           <LineChart
          xAxis={[{ data: xAxisData, label:'Month',scaleType: 'band' }]}
           series={[
                    {
                      data: yAxisCompleted, 
                      label: 'Handled Orders',
                      color: 'green',
                    },
                  ]}
                  width={800}
                  height={350}
              />
              }
       
        </div>
      </div>
      <div className='w-full flex flex-col items-center'>
         <h2 className='font-semibold self-start'>Shop Performance Salary</h2>
         <table className="w-full">
        <thead className='bg-[#BC4A4D] w-'>
                    <tr className='text-white'>
                        <th className="px-7 py-2 pr-10">Shop Name</th>
                        <th className="px-6 py-2">Total Revenue</th>
                        <th className="px-2 py-2">Completed Orders</th>
                        <th className="py-2 pr-1">Cancelled Orders</th>
                        <th className="px-2 py-2 pl-1">Average Order Value</th>
                    </tr>
                </thead>
               </table>
      </div>
      <div className='w-full h-[200px] hover:scale-[1.01] transition-transform duration-300 shadow-2xl rounded-2xl p-4 overflow-auto'>
          {loading ? (<div className="flex justify-center items-center h-full w-full">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>) : shopStats.map((shop) => (
          <div key={shop.id} className="adl-box p-2 rounded-lg overflow-auto">
            <div className="adl-box-content items-center">
              <div className="flex items-center gap-2">
                <div className='font-semibold text-2xl'>{shop.shopName}</div>
              </div>
              <div className='text-2xl'>{shop.totalRevenue} ₱</div>
              <div className='text-2xl'>{shop.completedOrders}</div>
              <div className='text-2xl'>{shop.cancelledOrders}</div>
              <div className='text-2xl'>{shop.averageOrderValue} ₱</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const DashersAnalytics = () => {
    const[currentDashers, setCurrentDashers] = useState([]);
    const[allDashers, setAllDashers] = useState([]);
    const [cancelledOrders, setCancelledOrders] = useState(0);
    const[completedOrders, setCompletedOrders] = useState(0);
    const [loading, setLoading] = useState(false);
    const[allOrders, setAllOrders] = useState([]);
    const [selectedYear,setSelectedYear] = useState(2024)
 

    const fetchDashers = async () => {
            setLoading(true);
            try {
                const response = await axios.get('/dashers/pending-lists');
                const pendingDashersHold = response.data.pendingDashers;
                const currentDashersHold = response.data.nonPendingDashers;
                const pendingDashersData = await Promise.all(
                    pendingDashersHold.map(async (dasher) => {
                        const pendingDashersDataResponse = await axios.get(`/users/${dasher.id}`);
                        const pendingDashersData = pendingDashersDataResponse.data;
                        return { ...dasher, userData: pendingDashersData };
                    })
                );
                const currentDashersData = await Promise.all(
                    currentDashersHold.map(async (dasher) => {
                        const currentDashersDataResponse = await axios.get(`/users/${dasher.id}`);
                        const currentDashersData = currentDashersDataResponse.data;
                        return { ...dasher, userData: currentDashersData };
                    })
                );

                const realDashers = currentDashersData.filter((dasher) => dasher.status === "active" || dasher.status === "offline");

                setAllDashers(currentDashersData);
                setCurrentDashers(realDashers);
            } catch (error) {
                console.error('Error fetching dashers:', error.response.data.error);
            }finally{
                setLoading(false);
            }
        };

    const fetchOrders = async () => {
        setLoading(true);
        try{
            const response = await axios.get('/orders/completed-orders')
            const allOrders = response.data.completedOrders;
            setAllOrders(allOrders);
        
        const maonani = allOrders.filter(order => order.status === 'completed')
        const dasherOrderCounts = maonani.reduce((acc, order) => {
            const dasherId = order.dasherId;
            if(!acc[dasherId]){
                acc[dasherId] = 0;
            }
            acc[dasherId]++;
            return acc;
        },{});
        
      console.log(dasherOrderCounts);
         const completedOrders = allOrders.filter(order => order.status === 'completed').length;
      const cancelledByShop = allOrders.filter(order => order.status === 'cancelled_by_shop').length;
      const cancelledByCustomer = allOrders.filter(order => order.status === 'cancelled_by_customer').length;
      const cancelledByDasher = allOrders.filter(order => order.status === 'cancelled_by_dasher').length;
      const totalOrders = completedOrders + cancelledByShop + cancelledByCustomer + cancelledByDasher;
      const completedPercentage = (completedOrders / totalOrders) * 100;
      const cancelledPercentage = ((cancelledByShop + cancelledByCustomer + cancelledByDasher) / totalOrders) * 100;
      setCompletedOrders(completedPercentage.toFixed(2));
      setCancelledOrders(cancelledPercentage.toFixed(2));




 setCurrentDashers((prevDashers) =>
        prevDashers.map((dasher) => ({
          ...dasher,
          completedOrders: dasherOrderCounts[dasher.id] || 0,
        })).sort((a, b) => b.completedOrders - a.completedOrders));

        }catch(error){
            console.error('Error fetching orders:', error.response.data.error);
        }finally{
            setLoading(false);
        }
    }


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


const { xAxisData, yAxisCompleted, yAxisCancelled } = formatCompletedOrdersByMonth(allOrders,selectedYear);


const sampleData = [
  {
    value: completedOrders,
    color: 'green',
    
  },
  {
    value: cancelledOrders,
    color: 'red',
  },
]

const valueFormatter = (item) => `${item.value}%`;

const handleYearChange = (event) => {
    setSelectedYear(event.target.value);
  };

     useEffect(() => {
  const fetchData = async () => {
    await fetchDashers();
    await fetchOrders();
  };
  fetchData();

}, []);


  return (
    <div className="p-2 items-center justify-center w-full h-full flex flex-col gap-2">
      <div className='flex items-center justify-between w-full gap-8'>
        <div className=' w-[550px] h-[550px] shadow-2xl rounded-2xl p-4 overflow-auto hover:scale-[1.01] transition-transform duration-300'>
        <div className='flex w-full justify-between items-center'>
            <h2 className='font-semibold'>Top Dashers</h2>
            <h2 className='font-semibold'>Total Orders Completed</h2>
        </div>
       {loading ? (<div className="flex justify-center items-center h-full w-full">
                        <div
                            className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>) : currentDashers.map((dasher, index) => (
          <div key={dasher.id} className="adl-box p-2 rounded-lg overflow-auto">
            <div className="adl-box-content">
              <div className="flex items-center gap-2">
                <span>{index + 1}.</span> 
                <img src={dasher.schoolId} alt="School ID" className="w-10 h-10" />
              </div>
              <div className='w-5'>{dasher.userData.firstname + " " + dasher.userData.lastname}</div>
              <div>{dasher.completedOrders}</div>
            </div>
          </div>
        ))}
        </div>
         <div className='flex flex-col gap-8'>
            <div className='items-center justify-center flex flex-col border  w-[450px] h-[550px] shadow-2xl rounded-2xl p-4 hover:scale-[1.02] transition-transform duration-300'>
           <h2 className='text-xl font-semibold self-start '>Completed Orders vs Cancelled Orders</h2> 
           <div className='self-end mt-6 flex-col flex items-start'>
            <div className='flex flex-row items-center justify-center gap-2'>
            <div className='rounded-full bg-green-700 w-4 h-4'></div>
            <div>Completed Orders</div>
            </div>
             <div className='flex flex-row items-center justify-center gap-2'>
            <div className='rounded-full bg-red-700 w-4 h-4'></div>
            <div>Cancelled Orders</div>
            </div>
           </div>
           {loading ? (<div className="flex justify-center items-center h-full w-full">
                        <div
                            className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>) : 
        <PieChart
  series={[
    {
      // data: [
      //   { id: 0, value: completedOrders, label: `Completed Orders`, color:'green' },
      //   { id: 1, value: cancelledOrders, label: `Cancelled Orders`, color:'red' },
      // ],
      data: sampleData,
     faded: { innerRadius: 20, additionalRadius: -20, color: 'gray' },
    highlightScope: { fade: 'global', highlight: 'item' },
    arcLabel: 'value',
    valueFormatter,
    },
  ]}
  height={400}
  width={400}
/>  }
        </div>
        </div>
        <div className=' w-[750px] h-[550px] hover:scale-[1.01] transition-transform duration-300 shadow-2xl rounded-2xl p-4 flex flex-col items-center justify-center'>
        <div className='flex items-center justify-between w-full'>
            <h2 className='font-semibold'>Orders Overtime</h2>
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
            {  loading ? (<div className="flex justify-center items-center h-full w-full">
                        <div
                            className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                            role="status">
                            <span
                                className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                            >Loading...</span>
                        </div>
                    </div>):   <LineChart
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
      width={800}
      height={500}
    />}
       
        </div>
      </div>
      <div className='w-full flex flex-col items-center'>
         <h2 className='font-semibold self-start'>Dasher Availability by Day</h2>
         <table className="w-full">
        <thead className='bg-[#BC4A4D] w-'>
                    <tr className='text-white'>
                        <th className="px-7 py-2 pr-10">Dasher</th>
                        <th className="px-6 py-2">Monday</th>
                        <th className="px-2 py-2">Tuesday</th>
                        <th className="py-2 pr-1">Wednesday</th>
                        <th className="px-2 py-2 pl-1">Thursday</th>
                        <th className="px-4 py-2 pl-2">Friday</th>
                        <th className="px-4 py-2 pr-2">Saturday</th>
                        <th className="px-4 py-2 pr-6 pl-3">Sunday</th>
                    </tr>
                </thead>
               </table>
      </div>
     <div className='w-full h-[200px] hover:scale-[1.01] transition-transform duration-300 shadow-2xl rounded-2xl p-4 overflow-auto self-end'>
    <div className='flex flex-col w-full'>
        <div className="overflow-x-auto">
            <table className="table-auto w-full">
                <tbody>
                    {loading ? (
                      <tr>
                            <td colSpan="8" className="text-center">
                                <div className="flex justify-center items-center h-full w-full">
                                    <div
                                        className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                                        role="status">
                                        <span
                                            className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                                        >Loading...</span>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        allDashers.map(dasher => (
                            <tr key={dasher.id}>
                               <td className="px-4 py-2 text-center">{dasher.userData.firstname + " " + dasher.userData.lastname}</td>
                                <td className={`px-4 py-2 text-center ${dasher.daysAvailable.includes('MON') ? 'text-green-500 font-semibold' : 'text-gray-400'}`}>{dasher.daysAvailable.includes('MON') ? 'Available' : 'Unavailable'}</td>
                                <td className={`px-4 py-2 text-center ${dasher.daysAvailable.includes('TUE') ? 'text-green-500 font-semibold' : 'text-gray-400'}`}>{dasher.daysAvailable.includes('TUE') ? 'Available' : 'Unavailable'}</td>
                                <td className={`px-4 py-2 text-center ${dasher.daysAvailable.includes('WED') ? 'text-green-500 font-semibold' : 'text-gray-400'}`}>{dasher.daysAvailable.includes('WED') ? 'Available' : 'Unavailable'}</td>
                                <td className={`px-4 py-2 text-center ${dasher.daysAvailable.includes('THU') ? 'text-green-500 font-semibold' : 'text-gray-400'}`}>{dasher.daysAvailable.includes('THU') ? 'Available' : 'Unavailable'}</td>
                                <td className={`px-4 py-2 text-center ${dasher.daysAvailable.includes('FRI') ? 'text-green-500 font-semibold' : 'text-gray-400'}`}>{dasher.daysAvailable.includes('FRI') ? 'Available' : 'Unavailable'}</td>
                                <td className={`px-4 py-2 text-center ${dasher.daysAvailable.includes('SAT') ? 'text-green-500 font-semibold' : 'text-gray-400'}`}>{dasher.daysAvailable.includes('SAT') ? 'Available' : 'Unavailable'}</td>
                                <td className={`px-4 py-2 text-center ${dasher.daysAvailable.includes('SUN') ? 'text-green-500 font-semibold' : 'text-gray-400'}`}>{dasher.daysAvailable.includes('SUN') ? 'Available' : 'Unavailable'}</td>
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
}


const AdminAnalytics = () => {
const [value, setValue] = useState('2');

const changeValue = (event, newValue) => {
    setValue(newValue);
}
const color = red[400];

    return (
    <div class="h-[100vh] pt-[70px] pr-[50px] pb-0 pl-[120px] flex flex-col items-center justify-center">        
        <TabContext value={value}>

    <div className="w-full h-12 border rounded-t-lg bg-[#BC4A4D] text-white font-semibold" >
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
    <div className="w-full h-full rounded-b-lg border bg-[#FFFAF1]">
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
    );
    }

export default AdminAnalytics;