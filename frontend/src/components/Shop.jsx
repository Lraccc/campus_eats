import React, { useEffect, useState } from "react";
import { useAuth } from "../utils/AuthContext";
import { useNavigate, useParams } from "react-router-dom";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';
import Navbar from "./Navbar/Navbar";
import AddToCartModal from "./AddToCartModal";
import axios from "../utils/axiosConfig";

const Shop = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();
    const { shopId } = useParams();
    const [shop, setShop] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [items, setItems] = useState([]);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loadingShop, setLoadingShop] = useState(true);
    const [loadingItems, setLoadingItems] = useState(true); 

    const fetchShop = async (shopId) => {
        try {
            const response = await axios.get(`/shops/${shopId}`);
            setShop(response.data);
        } catch (error) {
            console.error('Error fetching shop:', error);
            if (error.response.status === 404) {
                navigate('/home');
            }
        } finally {
            setLoadingShop(false);
        }
    };

    const fetchShopItems = async (shopId) => {
        try {
            const response = await axios.get(`/items/${shopId}/shop-items`);
            setItems(response.data);
        } catch (error) {
            console.error('Error fetching shop items:', error);
        } finally {
            setLoadingItems(false);
        }
    };

    useEffect(() => {
        fetchShop(shopId);
        fetchShopItems(shopId);
    }, [shopId]);

    const closeShowModal = () => {
        setShowModal(false);
    };

    const openModalWithItem = (item) => {
        setSelectedItem(item);
        setShowModal(true);
    };

    if (!currentUser) {
        navigate('/login');
    }

    const renderCategories = (categories) => {
        return Object.values(categories).map((category, index) => (
            <div key={index} className="bg-gray-200 px-2 py-1 rounded-md mr-2 mb-2">{category}</div>
        ));
    };

    return (
        <>
            <div className="bg-[#DFD6C5] h-screen p-24">
                <div className="flex">
                    <div className="relative p-8 bg-[#FFFAF1] rounded-2xl max-h-[calc(100vh-120px)] overflow-y-auto ml-16 w-72">
                        {loadingShop ? (
                            <div className="flex items-center justify-center h-52">
                                <div
                                    className="inline-block h-36 w-36 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                                    role="status">
                                    <span
                                        className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                                    >Loading...</span>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="w-58 h-52 overflow-hidden rounded-2xl bg-[#FFFAF1] flex items-center justify-center">
                                    <img src={shop.imageUrl} alt="store" className="w- h-full object-cover" />
                                </div>
                                <h2 className="font-semibold text-2xl pt-3">{shop.name}</h2>
                                <p className="text-sm">{shop.address}</p>
                                <div className="mt-5">
                                    <h4 className="font-semibold">Description</h4>
                                    <p className="text-sm">{shop.desc}</p>
                                    <h4 className="font-semibold mt-4">Category</h4>
                                    <div className="flex flex-wrap">{renderCategories(shop.categories)}</div>
                                </div>
                                <div className="mt-5">
                                    <h4 className="font-semibold">Delivery Fee</h4>
                                    <p>₱{shop.deliveryFee}</p>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="ml-20">
                        <h2 className="font-semibold text-2xl">Items</h2>
                        <div className="flex flex-wrap mt-8 gap-10">
                            {loadingItems ? (
                                <div className="flex items-center justify-center">
                                    <div
                                        className="inline-block h-24 w-24 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"
                                        role="status">
                                        <span
                                            className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]"
                                        >Loading...</span>
                                    </div>
                                </div>
                            ) : (
                                items.map(item => (
                                    <div
                                        key={item.id}
                                        className="w-60 h-72 bg-[#FFFAF1] rounded-2xl shadow-lg relative transition-transform duration-200 transform hover:scale-105 hover:shadow-xl hover:cursor-pointer"
                                        onClick={() => openModalWithItem(item)}
                                    >
                                        <div className="w-full h-1/2 rounded-t-2xl bg-gradient-to-b from-[#dfdddd] to-white relative overflow-hidden">
                                            <img src={item.imageUrl || '/Assets/Panda.png'} className="absolute inset-0 w-full h-full object-cover" alt="item" />
                                        </div>
                                        <div className="p-5 flex flex-col gap-2">
                                            <p className="font-semibold text-lg">{item.name}</p>
                                            <p className="text-gray-500 text-sm">{item.description}</p>
                                            <h3 className="font-semibold">₱{item.price.toFixed(2)}</h3>
                                            <div className="absolute bottom-3 right-3 bg-[#d15d61] rounded-full w-8 h-8 flex items-center justify-center transition duration-200 hover:bg-[#BC4A4D]">
                                                <FontAwesomeIcon icon={faPlus} className="text-white" />
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
                {showModal && <AddToCartModal item={selectedItem} showModal={showModal} onClose={closeShowModal} />}
            </div>
        </>
    );
}

export default Shop;
