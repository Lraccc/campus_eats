import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, Dimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"

const { width } = Dimensions.get("window")

const Order = () => {
    // Static data for the active order
    const activeOrder = {
        id: "12345",
        deliverTo: "Building A, Room 101",
        paymentMethod: "cash",
        mobileNum: "9123456789",
        totalPrice: 350.0,
        items: [
            { name: "Chicken Burger", quantity: 2, price: 120.0 },
            { name: "French Fries", quantity: 1, price: 80.0 },
            { name: "Soda", quantity: 1, price: 30.0 },
        ],
    }

    // Static data for the shop
    const shop = {
        name: "Burger Palace",
        address: "University Food Court",
        imageUrl:
            "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder-ob7miW3mUreePYfXdVwkpFWHthzoR5.svg?height=100&width=100",
        deliveryFee: 50.0,
    }

    // Static data for the dasher
    const dasherName = "John Doe"
    const dasherPhone = "9876543210"

    // Static data for order status
    const status = "Dasher is on the way to the shop."

    // Static data for past orders
    const orders = [
        {
            id: "12344",
            totalPrice: 280.0,
            status: "completed",
            createdAt: "2023-05-15T12:30:00Z",
            paymentMethod: "gcash",
            shopData: {
                name: "Pizza Corner",
                address: "Main Street",
                imageUrl:
                    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder-ob7miW3mUreePYfXdVwkpFWHthzoR5.svg?height=100&width=100",
            },
        },
        {
            id: "12343",
            totalPrice: 175.5,
            status: "cancelled_by_customer",
            createdAt: "2023-05-10T15:45:00Z",
            paymentMethod: "cash",
            shopData: {
                name: "Noodle House",
                address: "East Campus",
                imageUrl:
                    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder-ob7miW3mUreePYfXdVwkpFWHthzoR5.svg?height=100&width=100",
            },
        },
        {
            id: "12342",
            totalPrice: 420.75,
            status: "completed",
            createdAt: "2023-05-05T18:20:00Z",
            paymentMethod: "gcash",
            shopData: {
                name: "Sushi Express",
                address: "West Wing",
                imageUrl:
                    "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/placeholder-ob7miW3mUreePYfXdVwkpFWHthzoR5.svg?height=100&width=100",
            },
        },
    ]

    // Static data for offenses
    const offenses = 1

    return (
        <ScrollView style={styles.container}>
            {/* Active Order Section */}
            <Text style={styles.sectionTitle}>Active Order</Text>

            {activeOrder ? (
                <View style={styles.activeOrderContainer}>
                    {/* Order Details Card */}
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Order Details</Text>
                        <View style={styles.orderContent}>
                            <Image source={{ uri: shop.imageUrl }} style={styles.shopImage} />
                            <View style={styles.orderDetails}>
                                <Text style={styles.shopName}>{shop.name}</Text>
                                <Text style={styles.shopAddress}>{shop.address}</Text>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Dasher Name:</Text>
                                    <Text style={styles.detailValue}>{dasherName || "N/A"}</Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Dasher Phone:</Text>
                                    <TouchableOpacity>
                                        <Text style={styles.phoneLink}>{`+63 ${dasherPhone}` || "N/A"}</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Delivery Location:</Text>
                                    <Text style={styles.detailValue}>{activeOrder.deliverTo}</Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Order number:</Text>
                                    <Text style={styles.detailValue}>#{activeOrder.id}</Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Payment Method:</Text>
                                    <Text style={styles.detailValue}>{activeOrder.paymentMethod}</Text>
                                </View>

                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Phone number:</Text>
                                    <View style={styles.phoneContainer}>
                                        <Text style={styles.detailValue}>{activeOrder.mobileNum}</Text>
                                        <TouchableOpacity>
                                            <Text style={styles.editLink}>edit</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Order Summary */}
                        <View style={styles.orderSummary}>
                            <Text style={styles.summaryTitle}>Order Summary</Text>

                            {activeOrder.items.map((item, index) => (
                                <View key={index} style={styles.summaryItem}>
                                    <View style={styles.summaryItemHeader}>
                                        <Text style={styles.itemQuantity}>{item.quantity}x</Text>
                                        <Text style={styles.itemName}>{item.name}</Text>
                                    </View>
                                    <Text style={styles.itemPrice}>₱{item.price.toFixed(2)}</Text>
                                </View>
                            ))}

                            <View style={styles.totalContainer}>
                                <View style={styles.subtotalRow}>
                                    <Text style={styles.subtotalLabel}>Subtotal</Text>
                                    <Text style={styles.subtotalValue}>₱{activeOrder.totalPrice.toFixed(2)}</Text>
                                </View>

                                <View style={styles.subtotalRow}>
                                    <Text style={styles.subtotalLabel}>Delivery Fee</Text>
                                    <Text style={styles.subtotalValue}>₱{shop.deliveryFee.toFixed(2)}</Text>
                                </View>

                                <View style={styles.totalRow}>
                                    <Text style={styles.totalLabel}>Total</Text>
                                    <Text style={styles.totalValue}>₱{(activeOrder.totalPrice + shop.deliveryFee).toFixed(2)}</Text>
                                </View>
                            </View>

                            <View style={styles.buttonContainer}>
                                {activeOrder.paymentMethod === "gcash" && (
                                    <TouchableOpacity style={styles.refundButton}>
                                        <Text style={styles.refundButtonText}>Cancel and Refund</Text>
                                    </TouchableOpacity>
                                )}

                                {activeOrder.paymentMethod === "cash" && (
                                    <TouchableOpacity style={styles.cancelButton}>
                                        <Text style={styles.cancelButtonText}>Cancel Order</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>

                    {/* Status Card */}
                    <View style={styles.statusCard}>
                        <View style={styles.loaderContainer}>
                            <View style={styles.circle}>
                                <View style={styles.dot}></View>
                                <View style={styles.outline}></View>
                            </View>
                            <View style={styles.circle}>
                                <View style={styles.dot}></View>
                                <View style={styles.outline}></View>
                            </View>
                            <View style={styles.circle}>
                                <View style={styles.dot}></View>
                                <View style={styles.outline}></View>
                            </View>
                            <View style={styles.circle}>
                                <View style={styles.dot}></View>
                                <View style={styles.outline}></View>
                            </View>
                        </View>
                        <Text style={styles.statusText}>{status}</Text>
                    </View>
                </View>
            ) : (
                <Text style={styles.noOrderText}>No active order found.</Text>
            )}

            {/* Past Orders Section */}
            <View style={styles.pastOrdersHeader}>
                <Text style={styles.sectionTitle}>Past Orders</Text>
                {offenses > 0 && (
                    <View style={styles.warningContainer}>
                        <Text style={styles.warningText}>
                            <Text style={styles.warningBold}>Warning!</Text> x{offenses} {offenses > 1 ? "offenses" : "offense"}{" "}
                            recorded. 3 cancellations will lead to account ban.
                        </Text>
                    </View>
                )}
            </View>

            {orders.length === 0 ? (
                <Text style={styles.noOrderText}>No past orders...</Text>
            ) : (
                <View style={styles.pastOrdersContainer}>
                    {orders.map((order, index) => (
                        <TouchableOpacity key={index} style={styles.pastOrderCard}>
                            <Image source={{ uri: order.shopData.imageUrl }} style={styles.pastOrderImage} />
                            <View style={styles.pastOrderDetails}>
                                <View style={styles.pastOrderHeader}>
                                    <View>
                                        <Text style={styles.pastOrderShopName}>{order.shopData.name}</Text>
                                        <Text style={styles.pastOrderShopAddress}>{order.shopData.address}</Text>
                                    </View>
                                    <Text style={styles.pastOrderPrice}>₱{order.totalPrice.toFixed(2)}</Text>
                                </View>
                                <View style={styles.pastOrderInfo}>
                                    <Text style={styles.pastOrderStatus}>
                                        {order.status === "cancelled_by_shop"
                                            ? "Order was cancelled by shop"
                                            : order.status === "cancelled_by_customer"
                                                ? "Order was cancelled by customer"
                                                : order.status === "cancelled_by_dasher"
                                                    ? "Order was cancelled by dasher"
                                                    : order.status === "refunded"
                                                        ? "Order was refunded"
                                                        : order.status === "no-show"
                                                            ? "Customer did not show up for delivery"
                                                            : `Delivered on ${new Date(order.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`}
                                    </Text>
                                    <Text style={styles.pastOrderId}>Order #{order.id}</Text>
                                    <Text style={styles.pastOrderPayment}>
                                        {order.paymentMethod === "cash" ? "Cash On Delivery" : "GCASH"}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Modal Components */}
            <CancelOrderModal />
            <RefundOrderModal />
            <ReviewModal />
            <ReviewShopModal />
            <UserNoShowModal />
            <ShopCancelModal />
            <OrderEditPhoneNumModal />
        </ScrollView>
    )
}

// Modal Components (static, without functionality)
const CancelOrderModal = () => {
    return (
        <View style={[styles.modalContainer, { display: "none" }]}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Cancel Order</Text>
                <Text style={styles.modalText}>Are you sure you want to cancel your order?</Text>
                <Text style={styles.modalWarning}>Note: Cancelling orders may result in penalties.</Text>
                <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.modalCancelButton}>
                        <Text style={styles.modalCancelButtonText}>No, Keep Order</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalConfirmButton}>
                        <Text style={styles.modalConfirmButtonText}>Yes, Cancel Order</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    )
}

const RefundOrderModal = () => {
    return (
        <View style={[styles.modalContainer, { display: "none" }]}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Request Refund</Text>
                <Text style={styles.modalText}>Are you sure you want to cancel and request a refund?</Text>
                <Text style={styles.modalWarning}>Refunds may take 3-5 business days to process.</Text>
                <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.modalCancelButton}>
                        <Text style={styles.modalCancelButtonText}>No, Keep Order</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalConfirmButton}>
                        <Text style={styles.modalConfirmButtonText}>Yes, Request Refund</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    )
}

const ReviewModal = () => {
    return (
        <View style={[styles.modalContainer, { display: "none" }]}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Rate Your Order</Text>
                <Text style={styles.modalText}>How was your experience?</Text>
                <View style={styles.ratingContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star}>
                            <Ionicons name="star-outline" size={30} color="#FFD700" />
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.reviewInputContainer}>
                    <Text style={styles.inputLabel}>Leave a comment (optional)</Text>
                    <View style={styles.textInputPlaceholder} />
                </View>
                <TouchableOpacity style={styles.submitReviewButton}>
                    <Text style={styles.submitReviewButtonText}>Submit Review</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const ReviewShopModal = () => {
    return (
        <View style={[styles.modalContainer, { display: "none" }]}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Rate This Shop</Text>
                <Text style={styles.modalText}>How was your experience with this shop?</Text>
                <View style={styles.ratingContainer}>
                    {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star}>
                            <Ionicons name="star-outline" size={30} color="#FFD700" />
                        </TouchableOpacity>
                    ))}
                </View>
                <View style={styles.reviewInputContainer}>
                    <Text style={styles.inputLabel}>Leave a comment (optional)</Text>
                    <View style={styles.textInputPlaceholder} />
                </View>
                <TouchableOpacity style={styles.submitReviewButton}>
                    <Text style={styles.submitReviewButtonText}>Submit Review</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const UserNoShowModal = () => {
    return (
        <View style={[styles.modalContainer, { display: "none" }]}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Delivery Failed</Text>
                <Text style={styles.modalText}>The dasher reported that you were not available at the delivery location.</Text>
                <Text style={styles.modalWarning}>
                    This counts as an offense. Three offenses will result in account suspension.
                </Text>
                <TouchableOpacity style={styles.modalConfirmButton}>
                    <Text style={styles.modalConfirmButtonText}>I Understand</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const ShopCancelModal = () => {
    return (
        <View style={[styles.modalContainer, { display: "none" }]}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Order Cancelled</Text>
                <Text style={styles.modalText}>
                    The shop has cancelled your order. This could be due to unavailable items or shop closure.
                </Text>
                <Text style={styles.modalInfo}>
                    If you paid via GCash, a refund will be processed within 3-5 business days.
                </Text>
                <TouchableOpacity style={styles.modalConfirmButton}>
                    <Text style={styles.modalConfirmButtonText}>OK</Text>
                </TouchableOpacity>
            </View>
        </View>
    )
}

const OrderEditPhoneNumModal = () => {
    return (
        <View style={[styles.modalContainer, { display: "none" }]}>
            <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Edit Phone Number</Text>
                <Text style={styles.modalText}>Update your contact number for this delivery.</Text>
                <View style={styles.phoneInputContainer}>
                    <Text style={styles.inputLabel}>Phone Number</Text>
                    <View style={styles.textInputPlaceholder} />
                </View>
                <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.modalCancelButton}>
                        <Text style={styles.modalCancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalConfirmButton}>
                        <Text style={styles.modalConfirmButtonText}>Update</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#DFD6C5",
        padding: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: "600",
        marginVertical: 16,
        color: "#BC4A4D",
    },
    activeOrderContainer: {
        marginBottom: 24,
    },
    card: {
        backgroundColor: "#FFFAF1",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: "600",
        marginBottom: 16,
        color: "#BC4A4D",
    },
    orderContent: {
        flexDirection: "row",
        marginBottom: 16,
    },
    shopImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        marginRight: 16,
    },
    orderDetails: {
        flex: 1,
    },
    shopName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#BC4A4D",
    },
    shopAddress: {
        fontSize: 14,
        color: "#BBB4A",
        marginBottom: 8,
    },
    detailRow: {
        flexDirection: "row",
        marginTop: 4,
    },
    detailLabel: {
        fontSize: 14,
        color: "#BBB4A",
        width: 120,
    },
    detailValue: {
        fontSize: 14,
        color: "#BC4A4D",
        fontWeight: "500",
    },
    phoneLink: {
        fontSize: 14,
        color: "#BC4A4D",
        fontWeight: "500",
        textDecorationLine: "underline",
    },
    phoneContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    editLink: {
        fontSize: 14,
        color: "#BC4A4D",
        marginLeft: 8,
        textDecorationLine: "underline",
    },
    orderSummary: {
        borderTopWidth: 1,
        borderTopColor: "#BBB4A",
        paddingTop: 16,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 12,
        color: "#BC4A4D",
    },
    summaryItem: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    summaryItemHeader: {
        flexDirection: "row",
    },
    itemQuantity: {
        fontSize: 14,
        color: "#BBB4A",
        marginRight: 8,
    },
    itemName: {
        fontSize: 14,
        color: "#BC4A4D",
    },
    itemPrice: {
        fontSize: 14,
        color: "#BC4A4D",
        fontWeight: "500",
    },
    totalContainer: {
        marginTop: 16,
        borderTopWidth: 1,
        borderTopColor: "#BBB4A",
        paddingTop: 16,
    },
    subtotalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    subtotalLabel: {
        fontSize: 14,
        color: "#BBB4A",
    },
    subtotalValue: {
        fontSize: 14,
        color: "#BC4A4D",
    },
    totalRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: "#BBB4A",
        paddingTop: 8,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: "600",
        color: "#BC4A4D",
    },
    totalValue: {
        fontSize: 16,
        fontWeight: "600",
        color: "#BC4A4D",
    },
    buttonContainer: {
        marginTop: 16,
        flexDirection: "row",
        justifyContent: "center",
    },
    refundButton: {
        backgroundColor: "#BC4A4D",
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: 8,
    },
    refundButtonText: {
        color: "#FFFAF1",
        fontSize: 14,
        fontWeight: "600",
    },
    cancelButton: {
        backgroundColor: "#BC4A4D",
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        marginHorizontal: 8,
    },
    cancelButtonText: {
        color: "#FFFAF1",
        fontSize: 14,
        fontWeight: "600",
    },
    statusCard: {
        backgroundColor: "#FFFAF1",
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    loaderContainer: {
        flexDirection: "row",
        marginBottom: 16,
    },
    circle: {
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: "#BBB4A",
        marginHorizontal: 4,
        justifyContent: "center",
        alignItems: "center",
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#BC4A4D",
    },
    outline: {
        position: "absolute",
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: "#BC4A4D",
    },
    statusText: {
        fontSize: 16,
        color: "#BC4A4D",
        textAlign: "center",
    },
    noOrderText: {
        fontSize: 16,
        color: "#BBB4A",
        textAlign: "center",
        marginVertical: 24,
    },
    pastOrdersHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 16,
    },
    warningContainer: {
        backgroundColor: "#FFFAF1",
        padding: 8,
        borderRadius: 8,
        flex: 1,
        marginLeft: 16,
    },
    warningText: {
        fontSize: 12,
        color: "#BC4A4D",
    },
    warningBold: {
        fontWeight: "700",
    },
    pastOrdersContainer: {
        marginBottom: 24,
    },
    pastOrderCard: {
        backgroundColor: "#FFFAF1",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        flexDirection: "row",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    pastOrderImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 16,
    },
    pastOrderDetails: {
        flex: 1,
    },
    pastOrderHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    pastOrderShopName: {
        fontSize: 16,
        fontWeight: "600",
        color: "#BC4A4D",
    },
    pastOrderShopAddress: {
        fontSize: 14,
        color: "#BBB4A",
    },
    pastOrderPrice: {
        fontSize: 16,
        fontWeight: "600",
        color: "#BC4A4D",
    },
    pastOrderInfo: {
        marginTop: 4,
    },
    pastOrderStatus: {
        fontSize: 14,
        color: "#BBB4A",
        marginBottom: 4,
    },
    pastOrderId: {
        fontSize: 14,
        color: "#BBB4A",
        marginBottom: 4,
    },
    pastOrderPayment: {
        fontSize: 14,
        color: "#BBB4A",
    },
    // Modal styles
    modalContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
    },
    modalContent: {
        backgroundColor: "#FFFAF1",
        borderRadius: 12,
        padding: 24,
        width: "100%",
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "600",
        marginBottom: 16,
        color: "#BC4A4D",
        textAlign: "center",
    },
    modalText: {
        fontSize: 16,
        color: "#BC4A4D",
        marginBottom: 16,
        textAlign: "center",
    },
    modalWarning: {
        fontSize: 14,
        color: "#BC4A4D",
        marginBottom: 24,
        textAlign: "center",
    },
    modalInfo: {
        fontSize: 14,
        color: "#BBB4A",
        marginBottom: 24,
        textAlign: "center",
    },
    modalButtons: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    modalCancelButton: {
        backgroundColor: "#BBB4A",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        flex: 1,
        marginRight: 8,
        alignItems: "center",
    },
    modalCancelButtonText: {
        color: "#FFFAF1",
        fontSize: 14,
        fontWeight: "600",
    },
    modalConfirmButton: {
        backgroundColor: "#BC4A4D",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        flex: 1,
        marginLeft: 8,
        alignItems: "center",
    },
    modalConfirmButtonText: {
        color: "#FFFAF1",
        fontSize: 14,
        fontWeight: "600",
    },
    ratingContainer: {
        flexDirection: "row",
        justifyContent: "center",
        marginBottom: 24,
    },
    reviewInputContainer: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 14,
        color: "#BBB4A",
        marginBottom: 8,
    },
    textInputPlaceholder: {
        height: 100,
        borderWidth: 1,
        borderColor: "#BBB4A",
        borderRadius: 8,
        padding: 8,
    },
    submitReviewButton: {
        backgroundColor: "#BC4A4D",
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        alignItems: "center",
    },
    submitReviewButtonText: {
        color: "#FFFAF1",
        fontSize: 16,
        fontWeight: "600",
    },
    phoneInputContainer: {
        marginBottom: 24,
    },
})

export default Order
