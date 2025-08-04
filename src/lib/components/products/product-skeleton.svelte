<div class="product-skeleton">
  <div class="skeleton-image"></div>
  <div class="skeleton-content">
    <div class="skeleton-meta">
      <div class="skeleton-rating"></div>
      <div class="skeleton-sold"></div>
    </div>
    <div class="skeleton-title"></div>
    <div class="skeleton-title-2"></div>
    <div class="skeleton-price"></div>
    <div class="skeleton-location"></div>
    <div class="skeleton-button"></div>
  </div>
</div>

<style lang="scss">
  .product-skeleton {
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    overflow: hidden;
    border: 1px solid #f0f0f0;
    animation: pulse 1.5s ease-in-out infinite;
  }

  .skeleton-image {
    width: 100%;
    height: 200px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .skeleton-content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .skeleton-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .skeleton-rating {
    width: 80px;
    height: 14px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .skeleton-sold {
    width: 60px;
    height: 12px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .skeleton-title {
    width: 85%;
    height: 16px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .skeleton-title-2 {
    width: 60%;
    height: 16px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .skeleton-price {
    width: 100px;
    height: 20px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .skeleton-location {
    width: 70px;
    height: 12px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
  }

  .skeleton-button {
    width: 100%;
    height: 40px;
    background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 8px;
    margin-top: 8px;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.8;
    }
  }

  // Mobile optimizations
  @media (max-width: 768px) {
    .skeleton-image {
      height: 180px;
    }

    .skeleton-content {
      padding: 12px;
      gap: 10px;
    }

    .skeleton-button {
      height: 36px;
    }
  }

  @media (max-width: 480px) {
    .skeleton-image {
      height: 160px;
    }

    .skeleton-content {
      gap: 8px;
    }

    .skeleton-title,
    .skeleton-title-2 {
      height: 14px;
    }

    .skeleton-price {
      height: 18px;
    }
  }
</style>