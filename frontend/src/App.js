import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import AddItem from './components/AddItem';
import AdminDasherList from './components/AdminDasherList';
import AdminIncomingOrder from './components/AdminIncomingOrder';
import AdminOrderHistory from './components/AdminOrderHistory';
import AdminRoute from './components/AdminRoute';
import Checkout from './components/Checkout';
import DasherApplication from './components/DasherApplication';
import ForgotPassword from './components/ForgotPassword';
import Home from './components/Home';
import LandingPage from './components/LandingPage';
import LoginSignUp from './components/LoginSignUp';
import Order from './components/Order';
import PrivateRoute from './components/PrivateRoute';
import PublicRoute from './components/PublicRoute';
import ResetPassword from './components/ResetPassword';
import Shop from './components/Shop';
import ShopApplication from './components/ShopApplication';
import ShopManage from './components/ShopManage';
import ShopRoute from './components/ShopRoute';
import UpdateItem from './components/UpdateItem';
import UserProfile from './components/UserProfile';
import { AuthProvider } from './utils/AuthContext';
// import UpdateShop from './components/UpdateShop';
import { Toaster } from 'sonner';
import AdminAnalytics from './components/AdminAnalytics';
import AdminCashoutList from './components/AdminCashoutList';
import AdminReimburseList from './components/AdminReimburseList';
import AdminShopList from './components/AdminShopList';
import DasherCashout from './components/DasherCashout';
import DasherHome from './components/DasherHome';
import DasherIncomingOrder from './components/DasherIncomingOrder';
import DasherReimburse from './components/DasherReimburse';
import DasherRoute from './components/DasherRoute';
import DasherTopup from './components/DasherTopup';
import DasherUpdate from './components/DasherUpdate';
import MainLayout from './components/Layouts/MainLayout';
import ShopIncomingOrder from './components/ShopIncomingOrder';
import ShopUpdate from './components/ShopUpdate';
import VerificationFailed from './components/VerificationFailed';
import VerificationSuccess from './components/VerificationSuccess';
import { OrderProvider } from './context/OrderContext';

import 'react-confirm-alert/src/react-confirm-alert.css';
import ProfileRoute from './components/ProfileRoute';
import AdminUsers from './components/AdminUsers';

function App() {
  return (
      <Router>
        <AuthProvider>
          <OrderProvider>
            <Routes>
              <Route element={<MainLayout/>}>
                <Route path="/forgot-password" element={<PublicRoute Component={ForgotPassword} />} />
                <Route path="/reset-password/" element={<PublicRoute Component={ResetPassword} />} />
                <Route path="/login" element={<PublicRoute Component={LoginSignUp} />} />
                <Route path="/signup" element={<PublicRoute Component={LoginSignUp} />} />
                <Route path="/" element={<PublicRoute Component={LandingPage} />} />
                <Route path="/home" element={<PrivateRoute Component={Home}/>} />
                <Route path="/profile" element={<ProfileRoute Component={UserProfile} />} />

                <Route path="/admin-analytics" element={<AdminRoute Component={AdminAnalytics} />} />
                <Route path="/admin-dashers" element={<AdminRoute Component={AdminDasherList} />} />
                <Route path="/admin-incoming-order" element={<AdminRoute Component={AdminIncomingOrder} />} />
                <Route path="/admin-order-history" element={<AdminRoute Component={AdminOrderHistory} />} />
                <Route path="/admin-shops" element={<AdminShopList />} />
                <Route path="/admin-users" element={<AdminUsers />} />

                <Route path="/checkout/:uid/:shopId" element={<PrivateRoute Component={Checkout} />} />
                <Route path="/shop/:shopId" element={<PrivateRoute Component={Shop} />} />
                <Route path="/orders" element={<PrivateRoute Component={Order} />} />
                <Route path="/dasher-application" element={<PrivateRoute Component={DasherApplication} />} />
                <Route path="/shop-application" element={<PrivateRoute Component={ShopApplication} />} />
                <Route path="/dasher-orders" element={<DasherRoute Component={DasherHome} />} />
                <Route path="/dasher-incoming-order" element={<DasherRoute Component={DasherIncomingOrder} />} />
                <Route path="/shop-add-item" element={<ShopRoute Component={AddItem} />} />
                <Route path="/shop-manage-item" element={<ShopRoute Component={ShopManage} />} />
                <Route path="/dasher-update" element={<DasherRoute Component={DasherUpdate}/>} />
                <Route path="/shop-update" element={<ShopRoute Component={ShopUpdate} />} />
                <Route path="/edit-item/:itemId" element={<ShopRoute Component={UpdateItem} />} />

                <Route path="/cashout" element={<DasherRoute Component={DasherCashout}/>} />
                <Route path="/admin-cashouts" element={<AdminRoute Component={AdminCashoutList} />} />
                <Route path="/dasher-reimburse" element={<DasherRoute Component={DasherReimburse}/>} />
                <Route path="/admin-reimburse" element={<AdminRoute Component={AdminReimburseList} />} />
                <Route path="/dasher-topup" element={<DasherRoute Component={DasherTopup}/>} />

                <Route path="/shop-dashboard" element={<ShopRoute Component={ShopIncomingOrder} />} />
                <Route path="/verification-success" element={<VerificationSuccess />} />
                <Route path="/verification-failed" element={<VerificationFailed />} />
              </Route>
            </Routes>
            <Toaster expand={true} richColors/>
          </OrderProvider>
        </AuthProvider>
      </Router>
    
  );
}

export default App;
