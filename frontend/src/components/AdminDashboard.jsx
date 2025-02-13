import { useState } from "react";
import Navbar from "./Navbar/Navbar";
import { useAuth } from "../utils/AuthContext";
import "./css/AdminStats.css";

const AdminDashboard = () => {
  const [productList, setProductList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { currentUser } = useAuth();

  const lowStockProducts = productList.filter(
    (product) => product.quantity <= product.threshold
  );

  return (
    <>
      
      <div className="main-content">
        <div className="summary-containers">
          <div className="summary-container">
            <div>
              <h3>₱ --</h3>
              <span>Total Income</span>
            </div>
            <img src="/assets/cash-outline.svg" alt="Sales Icon" className="svg-icon" />
          </div>
          <div className="summary-container">
            <div>
              <h3>0</h3>
              <span>Daily Income</span>
            </div>
            <img src="/assets/cube-outline.svg" alt="Quantity Icon" className="svg-icon" />
          </div>
          <div className="summary-container">
            <div>
              <h3>--</h3>
              <span>Active Orders</span>
            </div>
            <img src="/assets/bag-check-outline.svg" alt="Purchase Icon" className="svg-icon" />
          </div>
          <div className="summary-container">
            <div>
              <h3>--</h3>
              <span>Online Dashers</span>
            </div>
            <img src="/assets/people-outline.svg" alt="Suppliers Icon" className="svg-icon" />
          </div>
        </div>
        <div className="flex-container">
          <div className="product-list-container h-[500px] overflow-y-auto">
            <h1>Shop Revenue</h1>
            <div className="table-container">
              <table className="product-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Sold Quantity</th>
                    <th>Remaining Quantity</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {productList.length === 0 ? (
                    <tr>
                      <td colSpan="4">No products available</td>
                    </tr>
                  ) : (
                    productList.map((product) => (
                      <tr key={product.id}>
                        <td>{product.name}</td>
                        <td>--</td>
                        <td>{product.quantity}</td>
                        <td>₱{product.buyingPrice}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="see-all">See All</div>
          </div>
          <div className="low-stock-container h-[500px] overflow-y-auto">
            <h1>Sold items by dashers</h1>
            <div className="table-container">
              <table className="product-table">
                <tbody>
                  {lowStockProducts.length === 0 ? (
                    <tr>
                      <td colSpan="3">No solds items yet</td>
                    </tr>
                  ) : (
                    lowStockProducts.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="product-image"
                          />
                        </td>
                        <td>
                          <div>
                            <span>{product.name}</span>
                            <span>Remaining Quantity: {product.quantity}</span>
                          </div>
                        </td>
                        <td><span className="low">Low</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="see-all">See All</div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AdminDashboard;
