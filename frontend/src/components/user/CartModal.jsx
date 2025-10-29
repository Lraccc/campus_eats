import { faMinus, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useCallback, useEffect, useState } from "react";
import { Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useOrderContext } from "../../context/OrderContext";
import { useAuth } from "../../utils/AuthContext";
import axios from '../../utils/axiosConfig';
import AlertModal from '../AlertModal';
import "../css/CartModal.css";

const CartModal = ({ showModal, onClose }) => {
    const { currentUser } = useAuth();
    // cartShops will be an array of shop-level carts: { shopId, items, totalPrice }
    const [cartShops, setCartShops] = useState([]);
    const [shopDataMap, setShopDataMap] = useState({});
    const [itemDetailsMap, setItemDetailsMap] = useState({});
    const { cartData: contextCartData, fetchData } = useOrderContext();
    const navigate = useNavigate();

    const [alertModal, setAlertModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: null,
        showConfirmButton: true,
    });

    // (per-shop checkout buttons are rendered inside each shop block)

    // normalize various backend response shapes into ShopCart[]
    const normalizeToShopCarts = (data) => {
        if (!data) return [];
        if (Array.isArray(data)) {
            if (data.length === 0) return [];
            if (data[0].shopId) return data; // already ShopCart[]
            if (data[0].shops && Array.isArray(data[0].shops)) {
                return data.flatMap(d => d.shops || []);
            }
            return data;
        }
        if (data.shops && Array.isArray(data.shops)) return data.shops;
        if (data.shopId && data.items && Array.isArray(data.items)) return [data];
        return [];
    };

    const fetchCartData = useCallback(async () => {
        try {
            const response = await axios.get(`/carts/cart`, {
                params: { uid: currentUser.id }
            });
            const shops = normalizeToShopCarts(response.data);
            setCartShops(shops);
        } catch (error) {
            console.error('Error fetching cart data:', error);
            setCartShops([]);
        }
    }, [currentUser]);

    useEffect(() => {
        if (showModal && currentUser) {
            fetchCartData();
        }
    }, [showModal, currentUser, fetchCartData, contextCartData]);

    useEffect(() => {
        // fetch shop metadata for each shop in cartShops
        const fetchAllShopData = async () => {
            if (!cartShops || cartShops.length === 0) return;
            const newMap = { ...shopDataMap };
            await Promise.all(cartShops.map(async (sc) => {
                if (!sc || !sc.shopId) return;
                if (newMap[sc.shopId]) return; // already fetched
                try {
                    const res = await axios.get(`/shops/${sc.shopId}`);
                    newMap[sc.shopId] = res.data;
                } catch (error) {
                    console.error('Error fetching shop data for', sc.shopId, error);
                }
            }));
            setShopDataMap(newMap);
        };
        fetchAllShopData();
    }, [cartShops]);

    useEffect(() => {
        // fetch item details for each item in the carts so we can show images
        const fetchItemDetails = async () => {
            if (!cartShops || cartShops.length === 0) return;
            const newMap = { ...itemDetailsMap };

            // For each shop, fetch that shop's items list (this returns ItemEntity[] with imageUrl)
            await Promise.all(cartShops.map(async (sc) => {
                if (!sc || !sc.shopId) return;
                try {
                    const res = await axios.get(`/items/${sc.shopId}/shop-items`);
                    const items = res.data && Array.isArray(res.data) ? res.data : (res.data && res.data.value ? res.data.value : []);
                    items.forEach(it => {
                        if (it && it.id) newMap[it.id] = it;
                    });
                } catch (error) {
                    // fallback: if shop-items endpoint failed, try to fetch items individually
                    console.error('Error fetching shop items for', sc.shopId, error);
                    (sc.items || []).forEach(async (it) => {
                        if (it && it.itemId && !newMap[it.itemId]) {
                            try {
                                const r = await axios.get(`/items/${it.itemId}`);
                                const d = r.data;
                                let entity = null;
                                if (!d) entity = null;
                                else if (d.imageUrl) entity = d;
                                else if (d.value && d.value.imageUrl) entity = d.value;
                                else if (d.present && d.value) entity = d.value;
                                else if (Array.isArray(d) && d.length > 0 && d[0].imageUrl) entity = d[0];
                                else {
                                    const maybe = (obj) => {
                                        if (!obj || typeof obj !== 'object') return null;
                                        for (const k of Object.keys(obj)) {
                                            const v = obj[k];
                                            if (v && typeof v === 'object' && v.imageUrl) return v;
                                        }
                                        return null;
                                    };
                                    entity = maybe(d) || null;
                                }
                                if (entity) newMap[it.itemId] = entity;
                            } catch (e) {
                                console.error('Error fetching item', it.itemId, e);
                            }
                        }
                    });
                }
            }));

            setItemDetailsMap(newMap);
        };
        fetchItemDetails();
    }, [cartShops]);

    const updateCartItem = async (itemId, action) => {
        try {
            const response = await axios.post('/carts/update-cart-item', {
                uid: currentUser.id,
                itemId,
                action
            });
            // backend returns CartEntity in response.data.cartData
            const result = response.data && response.data.cartData ? response.data.cartData : response.data;
            const shops = normalizeToShopCarts(result);
            setCartShops(shops);
            fetchData();
        } catch (error) {
            if (error && error.response && error.response.status === 400) {
                setAlertModal({
                    isOpen: true,
                    title: 'Error',
                    message: 'Quantity limit reached',
                    showConfirmButton: false,
                });
            } else {
                console.error(error && error.response ? error.response : error);
            }
        }
    };

    const handleItemIncrease = (item) => {
        updateCartItem(item.itemId, 'increase');
    };

    const handleItemDecrease = (item) => {
        updateCartItem(item.itemId, 'decrease');
    };

    const handleItemRemove = (item) => {
        setAlertModal({
            isOpen: true,
            title: "Confirm to Remove",
            message: `Are you sure you want to remove ${item.name} from your cart?`,
            onConfirm: () => updateCartItem(item.itemId, 'remove'),
            showConfirmButton: true,
        });
    };

    const handleShopRemove = (shopId, shopName) => {
        setAlertModal({
            isOpen: true,
            title: "Confirm to Remove Shop",
            message: `Are you sure you want to remove ${shopName}? This will remove all items in that shop's cart.`,
            onConfirm: async () => {
                try {
                    const response = await axios.delete('/carts/remove-cart', {
                        data: { uid: currentUser.id, shopId }
                    });
                    // normalize response if provided
                    const result = response.data || null;
                    const shops = normalizeToShopCarts(result);
                    if (shops && shops.length > 0) {
                        setCartShops(shops);
                    } else {
                        // If backend didn't return updated cart, refetch
                        await fetchCartData();
                    }
                    fetchData();
                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: response.data && response.data.message ? response.data.message : 'Shop removed',
                        showConfirmButton: false,
                    });
                    setTimeout(() => {
                        setAlertModal((prev) => ({ ...prev, isOpen: false }));
                    }, 2000);
                } catch (error) {
                    console.error('Error removing shop cart:', error);
                }
            },
            showConfirmButton: true,
        });
    };

    const handleProceedToCheckout = (shopId, shopCart) => {
        // close the modal first (if provided) so UI is clean, then navigate
        try { if (typeof onClose === 'function') onClose(); } catch (e) { /* ignore */ }
        // pass the shopCart in location state so Checkout can render immediately for that shop
        navigate(`/checkout/${currentUser.id}/${shopId}`, { state: { shopCart } });
    };

    // helper to derive an item's image URL from multiple possible shapes
    const getItemImageUrl = (item) => {
        if (!item) return '/Assets/Panda.png';
        // prefer fetching from the item details map using itemId
        if (item.itemId && itemDetailsMap[item.itemId] && itemDetailsMap[item.itemId].imageUrl) {
            return itemDetailsMap[item.itemId].imageUrl;
        }

        // common shapes: item.imageUrl, item.image, item.image_url
        if (item.imageUrl) return item.imageUrl;
        if (item.image) return item.image;
        if (item.image_url) return item.image_url;
        // sometimes the cart stores an embedded item object
        if (item.item && typeof item.item === 'object') {
            if (item.item.imageUrl) return item.item.imageUrl;
            if (item.item.image) return item.item.image;
            if (item.item.image_url) return item.item.image_url;
        }

        // fallback
        return '/Assets/Panda.png';
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
        <div className={`cart-modal ${showModal ? 'show' : ''}`}>
            <div className="cm-modal">
                <div className="cm-modal-divider">
                    <div className="cm-modal-header">
                        {(() => {
                            if (!cartShops || cartShops.length === 0) {
                                return <h3 className="cm-modal-title">Your cart is empty...</h3>;
                            }

                            return <h3 className="cm-modal-title">Your Items</h3>;
                        })()}
                    
                    </div>

                    <div className="cm-modal-body">
                        <div className="cm-items">
                            {cartShops.map((shopCart) => (
                                <div
                                    className="cm-shop-section"
                                    key={shopCart.shopId}
                                    style={{
                                        backgroundColor: '#FFF',
                                        borderRadius: 12,
                                        padding: 12,
                                        marginBottom: 12,
                                        boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
                                        border: '1px solid rgba(0,0,0,0.04)'
                                    }}
                                >
                                    <div className="cm-store-item" style={{marginBottom: 8}}>
                                        <div className="cm-item-left">
                                            <img
                                                src={shopDataMap[shopCart.shopId]?.imageUrl || '/Assets/store-location-icon.png'}
                                                alt="store loc"
                                                className="cm-image-store"
                                                style={{width:48,height:48,borderRadius:8,objectFit:'cover',marginRight:12}}
                                                onError={(e) => { e.target.onerror = null; e.target.src = '/Assets/store-location-icon.png'; }}
                                            />
                                            <div className="cm-store-title">
                                                <div style={{display:'flex', alignItems:'center', gap:8}}>
                                                    <h4 style={{margin:0,color:'#333'}}>{shopDataMap[shopCart.shopId] ? shopDataMap[shopCart.shopId].name : 'Store Name'}</h4>
                                                    <div style={{display:'flex', alignItems:'center', color:'#823033', fontSize:12}}>
                                                        <span style={{fontSize:12, color:'#6b6b6b'}}>{shopDataMap[shopCart.shopId]?.completedOrderCount ?? (shopCart.items ? shopCart.items.length : 0)}</span>
                                                    </div>
                                                </div>
                                                <p style={{margin:0,color:'#777',fontSize:12}}>{shopDataMap[shopCart.shopId] ? shopDataMap[shopCart.shopId].address : ''}</p>
                                            </div>
                                        </div>
                                        <div className="cm-item-right">
                                            <div className="cm-store-button">
                                                <Button className="cm-store-btn" onClick={() => handleShopRemove(shopCart.shopId, shopDataMap[shopCart.shopId]?.name || 'this shop')}>Remove</Button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Items for this shop */}
                                    {(shopCart.items || []).map(item => (
                                        <div className="cm-item cm-item-compact" key={item.itemId} style={{padding: '8px 6px', borderBottom: '1px solid rgba(0,0,0,0.04)'}}>
                                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%'}}>
                                                <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
                                                    {/* thumbnail if available */}
                                                    <img
                                                        src={getItemImageUrl(item)}
                                                        alt={item.name}
                                                        style={{width: 48, height: 48, objectFit: 'cover', borderRadius: 8}}
                                                        onError={(e) => { e.target.onerror = null; e.target.src = '/Assets/Panda.png'; }}
                                                    />
                                                    <div style={{minWidth: 160}}>
                                                        <div style={{fontSize: 14, fontWeight: 700, color: '#2c2c2c'}}>{item.name}</div>
                                                        <div style={{fontSize: 12, color: '#6b6b6b'}}>Qty: {item.quantity} • ₱{parseFloat(item.price).toFixed(2)}</div>
                                                    </div>
                                                </div>

                                                <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                                                    <button className="cm-button" onClick={() => item.quantity > 1 ? handleItemDecrease(item) : handleItemRemove(item)} style={{padding: '6px 8px'}} aria-label={`Decrease ${item.name}`}>
                                                        <FontAwesomeIcon icon={faMinus} />
                                                    </button>
                                                    <div style={{minWidth: 26, textAlign: 'center', fontWeight: 700}}>{item.quantity}</div>
                                                    <button className="cm-button" onClick={() => handleItemIncrease(item)} style={{padding: '6px 8px'}} aria-label={`Increase ${item.name}`}>
                                                        <FontAwesomeIcon icon={faPlus} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}

                                    <div className="cm-shop-footer" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 8}}>
                                        <div style={{display: 'flex', gap: 16, alignItems: 'center'}}>
                                            <div style={{textAlign: 'right'}}>
                                                <div style={{fontSize: 12, color: '#6b6b6b'}}>Delivery</div>
                                                <div style={{fontSize: 14, fontWeight: 700}}>₱{shopDataMap[shopCart.shopId] ? (parseFloat(shopDataMap[shopCart.shopId].deliveryFee || 0)).toFixed(2) : '0.00'}</div>
                                            </div>
                                            <div style={{textAlign: 'right'}}>
                                                <div style={{fontSize: 12, color: '#6b6b6b'}}>Shop total</div>
                                                <div style={{fontSize: 14, fontWeight: 700}}>₱{((parseFloat(shopCart.totalPrice || 0) + (shopDataMap[shopCart.shopId] ? parseFloat(shopDataMap[shopCart.shopId].deliveryFee || 0) : 0))).toFixed(2)}</div>
                                            </div>
                                        </div>
                                        <div className="cm-shop-actions">
                                            <Button
                                                disabled={!(shopCart.items && shopCart.items.length > 0)}
                                                variant="danger"
                                                onClick={() => handleProceedToCheckout(shopCart.shopId, shopCart)}
                                                style={{borderRadius: 10, padding: '8px 14px'}}
                                            >
                                                Checkout
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                {/* footer removed - per-shop totals and checkout buttons are shown inside each shop block */}
            </div>
        </div>
        </>
    );
}

export default CartModal;
