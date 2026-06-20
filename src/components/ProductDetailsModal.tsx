import React, { useState, useEffect } from "react";
import { X, Star, Heart, Plus, Minus, Share2, Check, ShoppingBag, ShieldCheck, MessageSquare, Send } from "lucide-react";
import { Product, Review, Order } from "../types";
import { auth, fetchReviewsFromFirebase, saveReviewToFirebase } from "../lib/firebase";

interface ProductDetailsModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  cartQty: number;
  onAddToCart: (p: Product) => void;
  onRemoveFromCart: (p: Product) => void;
  isWishlisted: boolean;
  onToggleWishlist: (p: Product) => void;
  allProducts: Product[];
  onProductClick: (p: Product) => void;
  orders?: Order[];
}

export default function ProductDetailsModal({
  product,
  isOpen,
  onClose,
  cartQty,
  onAddToCart,
  onRemoveFromCart,
  isWishlisted,
  onToggleWishlist,
  allProducts,
  onProductClick,
  orders = [],
}: ProductDetailsModalProps) {
  const [copiedLink, setCopiedLink] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (isOpen && product) {
      setReviewsLoading(true);
      setReviewError(null);
      setReviewSuccess(null);
      setIsEditing(false);
      fetchReviewsFromFirebase(product.id)
        .then((data) => {
          setReviews(data);
        })
        .catch((err) => {
          console.error("Failed to fetch reviews:", err);
        })
        .finally(() => {
          setReviewsLoading(false);
        });
    }
  }, [isOpen, product?.id]);

  if (!isOpen || !product) return null;

  const dynamicRating = reviews.length > 0 
    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
    : product.rating.toString();

  const dynamicRatingCount = reviews.length > 0 
    ? reviews.length
    : product.ratingCount;

  const user = auth.currentUser;
  const userOrders = user ? orders.filter((o) => o.userId === user.uid) : [];
  const deliveredOrderForProduct = userOrders.find((o) => 
    o.status === "delivered" && 
    o.items.some((item) => item.product.id === product.id)
  );
  const isEligibleToReview = !!deliveredOrderForProduct;
  const existingReview = reviews.find((r) => r.userId === user?.uid);

  const handleStartEdit = () => {
    const existing = reviews.find((r) => r.userId === auth.currentUser?.uid);
    if (existing) {
      setNewRating(existing.rating);
      setNewComment(existing.comment);
      setIsEditing(true);
      setReviewSuccess(null);
      setReviewError(null);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setReviewError("Please log in first to write a review.");
      return;
    }
    if (!newComment.trim()) {
      setReviewError("Review comment is required.");
      return;
    }

    if (!isEligibleToReview || !deliveredOrderForProduct) {
      setReviewError("Only customers who purchased and received this product can leave a review.");
      return;
    }

    const reviewId = `${currentUser.uid}_${product.id}`;
    const newRev: Review = {
      id: reviewId,
      productId: product.id,
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email?.split("@")[0] || "Verified Buyer",
      rating: newRating,
      comment: newComment.trim(),
      createdAt: new Date().toISOString(),
      orderId: deliveredOrderForProduct.id,
    };

    try {
      setReviewsLoading(true);
      await saveReviewToFirebase(newRev);
      
      if (isEditing) {
        setReviews((prev) =>
          prev.map((r) => (r.userId === currentUser.uid ? newRev : r))
        );
        setIsEditing(false);
        setReviewSuccess("Review updated successfully!");
      } else {
        setReviews((prev) => [newRev, ...prev]);
        setReviewSuccess("Review submitted successfully!");
      }
      setNewComment("");
      setNewRating(5);
    } catch (err: any) {
      setReviewError("Failed to submit review: " + err.message);
    } finally {
      setReviewsLoading(false);
    }
  };

  const savings = product.marketPrice - product.sellingPrice;
  const isOutOfStock = product.stock <= 0;

  // Find related products in same category (excluding current product)
  const related = allProducts
    .filter((p) => p.category === product.category && p.id !== product.id)
    .slice(0, 4);

  const handleShare = () => {
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      
      {/* Modal Container */}
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-200"
        id="product-details-modal"
      >
        
        {/* Close Button Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 border border-gray-100 text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition active:scale-95"
          id="close-details-modal"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Product Grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Column 1: Image & Sharing Options */}
          <div className="flex flex-col items-center">
            <div className="relative w-full aspect-square max-w-[340px] rounded-2xl bg-gray-50 overflow-hidden flex items-center justify-center border border-gray-100">
              <img
                src={product.image}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              {product.discount > 0 && (
                <span className="absolute top-3 left-3 rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-black text-white">
                  {product.discount}% OFF
                </span>
              )}
            </div>

            {/* Quick Share / Wishlist Bar */}
            <div className="flex items-center space-x-3 mt-4 w-full justify-center">
              <button
                onClick={() => onToggleWishlist(product)}
                className={`flex items-center space-x-1.5 px-4 py-2 border rounded-xl text-xs font-bold transition active:scale-95 ${
                  isWishlisted
                    ? "border-red-100 bg-red-50 text-red-500"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                <Heart className={`h-4.5 w-4.5 ${isWishlisted ? "fill-red-500" : ""}`} />
                <span>{isWishlisted ? "In Wishlist" : "Save to Wishlist"}</span>
              </button>

              <button
                onClick={handleShare}
                className={`flex items-center space-x-1.5 px-4 py-2 border rounded-xl text-xs font-bold transition active:scale-95 ${
                  copiedLink
                    ? "border-green-100 bg-green-50 text-green-600"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50"
                }`}
              >
                {copiedLink ? <Check className="h-4.5 w-4.5" /> : <Share2 className="h-4.5 w-4.5" />}
                <span>{copiedLink ? "Link Copied!" : "Share Link"}</span>
              </button>
            </div>
          </div>

          {/* Column 2: Information Content */}
          <div className="flex flex-col justify-between text-left">
            <div>
              
              {/* Category & Status */}
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black text-orange-500 bg-orange-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  {product.brand}
                </span>
                <span className="text-[10px] font-extrabold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  {product.category}
                </span>
              </div>

              {/* Title */}
              <h1 className="mt-2 text-xl sm:text-2xl font-black text-gray-900 leading-tight">
                {product.name}
              </h1>

              {/* Ratings */}
              <div className="mt-2 flex items-center space-x-2">
                <div className="flex items-center bg-green-500 text-white p-1 px-2 rounded-lg text-xs font-black">
                  <Star className="h-3 w-3 fill-white mr-1" />
                  <span>{dynamicRating}</span>
                </div>
                <span className="text-xs text-gray-400 font-semibold">{dynamicRatingCount} Verified Reviews</span>
                <span className="text-gray-300">•</span>
                <span className="text-xs font-bold text-green-600">15 min delivery ready</span>
              </div>

              {/* Description */}
              <p className="mt-4 text-xs sm:text-sm text-gray-600 font-medium leading-relaxed">
                {product.description}
              </p>

              {/* Ingredients Details */}
              {product.ingredients && (
                <div className="mt-4 bg-gray-50/50 rounded-xl p-3 border border-gray-150">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Ingredients</h4>
                  <p className="text-xs text-gray-500 font-medium mt-1 leading-normal">{product.ingredients}</p>
                </div>
              )}

              {/* Nutritional breakdown */}
              {product.nutrition && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-1.5">Nutrition Facts (Per serving)</h4>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="bg-gray-50 rounded-xl p-2 text-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Calories</p>
                      <p className="text-xs font-extrabold text-gray-800">{product.nutrition.calories}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2 text-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Protein</p>
                      <p className="text-xs font-extrabold text-gray-800">{product.nutrition.protein}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2 text-center">
                      <p className="text-[9px] font-bold text-gray-400 uppercase">Carbohydrates</p>
                      <p className="text-xs font-extrabold text-gray-800">{product.nutrition.carbs}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-2 text-center">
                      <p className="text-[9px] font-bold text-gray-405 uppercase">Fats</p>
                      <p className="text-xs font-extrabold text-gray-800">{product.nutrition.fat}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Cold Drink disclaimer warning */}
              {product.category && (
                product.category.toLowerCase().includes("cold drink") ||
                product.category.toLowerCase().includes("soft drink") ||
                product.category.toLowerCase().includes("beverage") ||
                product.category.toLowerCase().includes("juice")
              ) && (
                <div className="mt-5 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start space-x-2 text-amber-900 shadow-sm" id="product-cold-drink-notice">
                  <span className="text-base shrink-0 select-none">⚠️</span>
                  <div className="text-xs font-medium leading-relaxed">
                    <strong className="font-extrabold text-amber-950">Cold Drink Notice:</strong> Due to delivery time, weather conditions, and extreme temperatures, cold drinks may not always remain chilled upon delivery.
                  </div>
                </div>
              )}

            </div>

            {/* Price section & Dual action add */}
            <div className="mt-6 pt-5 border-t border-gray-150">
              <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
                
                {/* Pricing Box */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Pricing & Savings</p>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-2xl font-black text-gray-900">₹{product.sellingPrice}</span>
                    {product.discount > 0 && (
                      <span className="text-sm font-semibold text-gray-400 line-through">MRP ₹{product.marketPrice}</span>
                    )}
                  </div>
                  {savings > 0 && (
                    <p className="text-xs font-black text-green-600 mt-1">
                      You Save ₹{savings} ({product.discount}% lower than MRP!)
                    </p>
                  )}
                </div>

                {/* Add action */}
                <div className="w-full sm:w-auto">
                  {isOutOfStock ? (
                    <div className="rounded-xl bg-gray-150 p-2 text-center font-bold text-gray-400 cursor-not-allowed">
                      Product Out of Stock
                    </div>
                  ) : cartQty > 0 ? (
                    <div className="flex items-center justify-between border border-transparent bg-green-500 text-white rounded-xl px-4 py-2 px-3 shadow-lg shadow-green-100">
                      <span className="text-xs font-bold mr-3">Added to Cart</span>
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => onRemoveFromCart(product)}
                          className="p-1 hover:bg-white/10 rounded-lg transition"
                        >
                          <Minus className="h-3.5 w-3.5 font-bold" />
                        </button>
                        <span className="text-sm font-black w-4 text-center">{cartQty}</span>
                        <button 
                          onClick={() => onAddToCart(product)}
                          className="p-1 hover:bg-white/10 rounded-lg transition"
                        >
                          <Plus className="h-3.5 w-3.5 font-bold" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => onAddToCart(product)}
                      className="w-full sm:w-auto flex items-center justify-center space-x-2 rounded-xl bg-green-500 hover:bg-green-600 px-6 py-3 text-white font-black text-xs shadow-md shadow-green-100 transition active:scale-95"
                    >
                      <ShoppingBag className="h-4.5 w-4.5" />
                      <span>ADD ITEMS TO CART</span>
                    </button>
                  )}
                </div>

              </div>

              {/* Delivery Promise Badge */}
              <div className="flex items-center space-x-2 mt-4 bg-orange-50 p-2.5 rounded-xl border border-orange-100">
                <ShieldCheck className="h-4 w-4 text-orange-500 shrink-0" />
                <p className="text-[10px] text-orange-850 font-bold leading-none">
                  SmartCart Guarantee: Fresh groceries delivered to your door in approximately 15 minutes!
                </p>
              </div>

            </div>

          </div>

        </div>

        {/* Related Products list */}
        {related.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-100 text-left">
            <h3 className="text-base font-black text-gray-800 tracking-tight">Customers Also Bought</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-3">Fresh alternatives from {product.category}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {related.map((p) => {
                const subSavings = p.marketPrice - p.sellingPrice;
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      onProductClick(p);
                    }}
                    className="cursor-pointer group flex flex-col p-2.5 rounded-xl border border-gray-100 hover:border-gray-200 bg-white transition"
                  >
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center relative">
                      <img src={p.image} alt={p.name} className="h-16 w-16 object-cover" />
                      {p.discount > 0 && (
                        <span className="absolute top-1 left-1 bg-orange-500 text-white text-[8px] font-black p-0.5 rounded">
                          -{p.discount}%
                        </span>
                      )}
                    </div>
                    <h4 className="mt-1.5 text-xs font-bold text-gray-800 truncate leading-tight group-hover:text-green-600">
                      {p.name}
                    </h4>
                    <div className="flex items-baseline space-x-1 mt-0.5">
                      <span className="text-xs font-black text-gray-900">₹{p.sellingPrice}</span>
                      {p.discount > 0 && (
                        <span className="text-[8px] text-gray-400 line-through">₹{p.marketPrice}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* --- RATINGS & REVIEWS SECTION --- */}
        <div className="mt-8 pt-6 border-t border-gray-100 text-left">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-black text-gray-800 tracking-tight flex items-center gap-1.5">
                <MessageSquare className="h-5 w-5 text-green-600" />
                <span>Customer Ratings & Reviews</span>
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                Authentic experiences shared by our community
              </p>
            </div>

            {/* Dynamic average badge */}
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-150 p-3 rounded-2xl w-fit">
              <span className="text-3xl font-black text-gray-900">{dynamicRating}</span>
              <div>
                <div className="flex gap-0.5 text-yellow-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star 
                      key={i} 
                      className={`h-3.5 w-3.5 ${i < Math.round(parseFloat(dynamicRating)) ? "fill-yellow-400" : "text-gray-300"}`} 
                    />
                  ))}
                </div>
                <p className="text-[10px] font-black text-gray-400 uppercase mt-0.5">
                  Based on {dynamicRatingCount} Reviews
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Form to Write a Review */}
            <div className="lg:col-span-1 bg-gray-50/50 rounded-2xl p-4 border border-gray-150 h-fit">
              <h4 className="text-xs font-black text-gray-800 uppercase tracking-wide mb-3 animate-pulse">
                {isEditing ? "✏️ Edit Your Review" : "✍️ Write a Review"}
              </h4>

              {!auth.currentUser ? (
                <div className="text-center py-6 bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <p className="text-xs text-gray-500 font-bold mb-2">
                    You must be signed in to submit reviews.
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                    Only customers who purchased and received this product can leave a review.
                  </p>
                </div>
              ) : !isEligibleToReview ? (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                  <div className="h-8 w-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-2 font-black text-sm">
                    !
                  </div>
                  <p className="text-xs font-black text-amber-900 uppercase tracking-wide">
                    Access Restricted
                  </p>
                  <p className="text-[11px] text-amber-700 font-bold mt-2 leading-relaxed">
                    Only customers who purchased and received this product can leave a review.
                  </p>
                  <p className="text-[9px] text-amber-600/70 font-semibold mt-1">
                    Verified purchase containing this product is required.
                  </p>
                </div>
              ) : existingReview && !isEditing ? (
                <div className="bg-green-50 border border-green-100 rounded-xl p-4 text-center">
                  <div className="h-8 w-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-2 font-black text-sm">
                    ✓
                  </div>
                  <p className="text-xs font-black text-green-800">
                    Your Review is Published
                  </p>
                  
                  {/* Small preview of existing review */}
                  <div className="my-3 border-t border-b border-green-100/60 py-2.5 text-left">
                    <div className="flex gap-0.5 text-yellow-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star 
                          key={i} 
                          className={`h-3 w-3 ${i < existingReview.rating ? "fill-yellow-500 text-yellow-500" : "text-gray-200"}`} 
                        />
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-700 italic mt-1.5 font-medium line-clamp-3">
                      "{existingReview.comment}"
                    </p>
                  </div>

                  <p className="text-[10px] text-green-600 font-semibold mt-1 leading-relaxed mb-3">
                    Duplicate postings are restricted, but you can modify your review anytime.
                  </p>
                  
                  <button
                    onClick={handleStartEdit}
                    className="w-full flex items-center justify-center gap-1.5 py-2 bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-xs transition active:scale-95 cursor-pointer font-sans"
                  >
                    Edit Review
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitReview} className="space-y-3">
                  {/* Star selector */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                      Choose Your Rating
                    </label>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: 5 }).map((_, i) => {
                        const starVal = i + 1;
                        return (
                          <button
                            type="button"
                            key={i}
                            onClick={() => setNewRating(starVal)}
                            className="p-1 hover:scale-110 active:scale-95 transition cursor-pointer"
                          >
                            <Star 
                              className={`h-6 w-6 transition ${
                                starVal <= newRating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
                              }`} 
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Comment Box */}
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">
                      Your Opinion / Critique
                    </label>
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Was it fresh? Cleanly packed? Share your honest opinion to guide other buyers..."
                      rows={4}
                      className="w-full rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-green-500 font-medium"
                    />
                  </div>

                  {/* Feedback alerts */}
                  {reviewError && (
                    <p className="text-[10px] text-red-600 font-bold bg-red-50 border border-red-100 p-2 rounded-lg">
                      {reviewError}
                    </p>
                  )}
                  {reviewSuccess && (
                    <p className="text-[10px] text-green-600 font-bold bg-green-50/70 border border-green-100 p-2 rounded-lg">
                      {reviewSuccess}
                    </p>
                  )}

                  <div className="flex gap-2">
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditing(false);
                          setReviewSuccess(null);
                          setReviewError(null);
                        }}
                        className="w-1/3 py-2.5 bg-gray-150 hover:bg-gray-200 text-gray-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition active:scale-95 cursor-pointer font-sans"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="submit"
                      disabled={reviewsLoading}
                      className={`${isEditing ? "w-2/3" : "w-full"} flex items-center justify-center gap-1.5 py-2.5 bg-green-500 hover:bg-green-600 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-green-100 transition active:scale-95 disabled:bg-gray-300 cursor-pointer`}
                    >
                      <Send className="h-3.5 w-3.5 text-white" />
                      <span>{reviewsLoading ? "Saving..." : isEditing ? "Save Changes" : "Post Review"}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Right Column: Existing Reviews List */}
            <div className="lg:col-span-2 space-y-4 max-h-[400px] overflow-y-auto pr-2">
              <h4 className="text-xs font-black text-gray-800 uppercase tracking-wide mb-3">
                Reviews ({reviews.length})
              </h4>

              {reviewsLoading && reviews.length === 0 ? (
                <p className="text-xs text-gray-400 font-medium py-4 text-center">Loading reviews...</p>
              ) : reviews.length === 0 ? (
                <div className="text-center py-10 bg-gray-50/30 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-xs text-gray-500 font-bold">No reviews yet</p>
                  <p className="text-[10px] text-gray-400 font-medium mt-1">
                    Be the very first reviewer to rate and share your experience with this item!
                  </p>
                </div>
              ) : (
                reviews.map((r) => (
                  <div key={r.id} className="bg-white border border-gray-105 rounded-2xl p-4 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-green-50 border border-green-100 text-green-600 flex items-center justify-center font-black text-xs">
                          {r.userName.substring(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-black text-gray-805 leading-none capitalize">
                              {r.userName}
                            </p>
                            {auth.currentUser && r.userId === auth.currentUser.uid && (
                              <button 
                                onClick={handleStartEdit}
                                className="text-[10px] font-bold text-green-600 hover:text-green-700 underline cursor-pointer hover:scale-105 transition"
                              >
                                (Edit yours)
                              </button>
                            )}
                          </div>
                          <p className="text-[9px] font-black text-green-700 bg-green-50 px-2 py-0.5 rounded-full uppercase tracking-wide inline-flex items-center gap-1 mt-1 leading-none border border-green-200">
                            <Check className="h-2.5 w-2.5 stroke-[4]" /> Verified Purchase
                          </p>
                        </div>
                      </div>
                      <span className="text-[9px] text-gray-400 font-semibold">
                        {new Date(r.createdAt).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    {/* Rendering review stars */}
                    <div className="flex gap-0.5 text-yellow-400 mt-2.5">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <Star 
                          key={index} 
                          className={`h-3 w-3 ${index < r.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200"}`} 
                        />
                      ))}
                    </div>

                    <p className="text-xs text-gray-650 leading-relaxed font-semibold mt-2">
                      {r.comment}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
