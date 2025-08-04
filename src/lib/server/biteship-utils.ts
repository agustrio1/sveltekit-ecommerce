import 'dotenv/config';

const BITESHIP_API_KEY = process.env.BITESHIP_API_KEY!;
const BITESHIP_BASE_URL = 'https://api.biteship.com/v1';

export interface BiteshipArea {
  id: string;
  name: string;
  country_code: string;
  country_name: string;
  postal_code: string;
  administrative_division_level_1_name: string;
  administrative_division_level_2_name: string;
  administrative_division_level_3_name: string;
  administrative_division_level_4_name: string;
  administrative_division_level_1_type: string;
  administrative_division_level_2_type: string;
  administrative_division_level_3_type: string;
  administrative_division_level_4_type: string;
}

export interface CourierAvailability {
  company: string;
  type: string;
  name: string;
  logo: string;
  available_for_cash_on_delivery: boolean;
  available_for_proof_of_delivery: boolean;
  available_for_instant_waybill_id: boolean;
  available_for_insurance: boolean;
}

export interface ShippingRate {
  courier_name: string;
  courier_code: string;
  courier_service_name: string;
  courier_service_code: string;
  price: number;
  duration: string;
  description: string;
  insurance_fee?: number;
}

// Cache systems
const AREA_CACHE = new Map<string, { data: any; timestamp: number }>();
const SHIPPING_CACHE = new Map<string, { data: any; timestamp: number }>();
const AREA_REQUESTS = new Map<string, Promise<any>>();
const SHIPPING_REQUESTS = new Map<string, Promise<any>>();

// Cache durations
const AREA_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const SHIPPING_CACHE_DURATION = 5 * 60 * 1000;   // 5 minutes for real data

/**
 * Extract postal code from area name or use fallback
 */
function extractPostalCode(area: any): string {
  if (area.postal_code) return area.postal_code;
  if (area.postalCode) return area.postalCode;
  if (area.zip_code) return area.zip_code;
  
  if (area.name) {
    const postalMatch = area.name.match(/(\d{5})/);
    if (postalMatch) {
      return postalMatch[1];
    }
  }
  
  return '';
}

/**
 * Create Biteship request with proper error handling
 */
async function makeBiteshipRequest(url: string, options: RequestInit = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    console.log('🔗 Making Biteship request:', url);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${BITESHIP_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    console.log('📡 Biteship response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Biteship API error response:', errorText);
      throw new Error(`Biteship API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Biteship response received successfully');
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    console.error('❌ Biteship request failed:', error);
    throw error;
  }
}

/**
 * Get area information by postal code
 */
export async function getAreaByPostalCode(postalCode: string): Promise<BiteshipArea | null> {
  const cacheKey = `postal_${postalCode}`;
  
  const cached = AREA_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < AREA_CACHE_DURATION) {
    console.log('Using cached postal code lookup');
    return cached.data;
  }

  if (AREA_REQUESTS.has(cacheKey)) {
    console.log('Waiting for existing postal code request');
    return await AREA_REQUESTS.get(cacheKey);
  }

  const requestPromise = (async () => {
    try {
      console.log('Getting area by postal code:', postalCode);
      
      const url = `${BITESHIP_BASE_URL}/maps/areas?countries=ID&input=${encodeURIComponent(postalCode)}`;
      const data = await makeBiteshipRequest(url);

      if (data.success && data.areas && data.areas.length > 0) {
        let matchedArea = data.areas.find((area: any) => {
          const areaPostalCode = extractPostalCode(area);
          return areaPostalCode === postalCode;
        });

        if (!matchedArea) {
          matchedArea = data.areas[0];
        }
        
        const result = {
          id: matchedArea.id || '',
          name: matchedArea.name || '',
          country_code: matchedArea.country_code || 'ID',
          country_name: matchedArea.country_name || 'Indonesia',
          postal_code: postalCode,
          administrative_division_level_1_name: matchedArea.administrative_division_level_1_name || '',
          administrative_division_level_2_name: matchedArea.administrative_division_level_2_name || '',
          administrative_division_level_3_name: matchedArea.administrative_division_level_3_name || '',
          administrative_division_level_4_name: matchedArea.administrative_division_level_4_name || '',
          administrative_division_level_1_type: matchedArea.administrative_division_level_1_type || 'province',
          administrative_division_level_2_type: matchedArea.administrative_division_level_2_type || 'city',
          administrative_division_level_3_type: matchedArea.administrative_division_level_3_type || 'district',
          administrative_division_level_4_type: matchedArea.administrative_division_level_4_type || 'village'
        } as BiteshipArea;

        AREA_CACHE.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        });

        return result;
      }

      return null;
    } finally {
      AREA_REQUESTS.delete(cacheKey);
    }
  })();

  AREA_REQUESTS.set(cacheKey, requestPromise);
  return await requestPromise;
}

/**
 * Calculate package dimensions from items
 */
export function calculatePackageDimensions(items: Array<{
  weight: number;
  height: number;
  length: number;
  width: number;
  quantity: number;
  value?: number;
}>) {
  console.log('📦 Calculating package dimensions for items:', items);
  
  let totalWeight = 0;
  let totalValue = 0;
  let maxHeight = 0;
  let maxLength = 0;
  let maxWidth = 0;
  
  items.forEach((item, index) => {
    const itemWeight = Math.max(item.weight || 100, 100) * item.quantity;
    const itemValue = Math.max(item.value || 10000, 10000) * item.quantity;
    const itemHeight = Math.max(item.height || 1, 1);
    const itemLength = Math.max(item.length || 1, 1);
    const itemWidth = Math.max(item.width || 1, 1);
    
    console.log(`📦 Item ${index + 1}: ${itemWeight}g, ${itemHeight}x${itemLength}x${itemWidth}cm, Rp${itemValue}`);
    
    totalWeight += itemWeight;
    totalValue += itemValue;
    
    maxHeight = Math.max(maxHeight, itemHeight);
    maxLength = Math.max(maxLength, itemLength);
    maxWidth = Math.max(maxWidth, itemWidth);
  });
  
  const finalDimensions = {
    weight: Math.max(totalWeight, 100),
    height: Math.max(maxHeight, 1),
    length: Math.max(maxLength, 1),
    width: Math.max(maxWidth, 1),
    value: Math.max(totalValue, 10000)
  };
  
  console.log('📦 Final package dimensions:', finalDimensions);
  return finalDimensions;
}

/**
 * REAL Biteship API - Calculate shipping rates using FIXED REQUEST FORMATS
 */
export async function calculateShippingRates(
  originPostalCode: string,
  destinationPostalCode: string,
  items: Array<{
    weight: number;
    height: number;
    length: number;
    width: number;
    quantity: number;
    value: number;
  }>
): Promise<ShippingRate[]> {
  const packageData = calculatePackageDimensions(items);
  
  const timestamp = Math.floor(Date.now() / (5 * 60 * 1000)); // Update every 5 minutes
  const cacheKey = `rates_${originPostalCode}_${destinationPostalCode}_${JSON.stringify(packageData)}_${timestamp}`;
  
  const cached = SHIPPING_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < SHIPPING_CACHE_DURATION) {
    console.log('✅ Using cached shipping rates');
    return cached.data;
  }

  if (SHIPPING_REQUESTS.has(cacheKey)) {
    console.log('⏳ Waiting for existing shipping rates calculation');
    return await SHIPPING_REQUESTS.get(cacheKey);
  }

  const requestPromise = (async () => {
    try {
      console.log('🚚 REAL BITESHIP API: Starting shipping calculation...');
      console.log('📦 Package data:', packageData);
      console.log('📍 Route:', `${originPostalCode} → ${destinationPostalCode}`);

      // Strategy 1: Get area IDs first, then use /rates/couriers with area IDs
      console.log('🔄 Strategy 1: Get area IDs first...');
      
      const [originArea, destinationArea] = await Promise.all([
        getAreaByPostalCode(originPostalCode),
        getAreaByPostalCode(destinationPostalCode)
      ]);

      if (!originArea || !destinationArea) {
        console.error('❌ Could not find area data for postal codes');
        throw new Error(`Area not found for postal codes: ${originPostalCode} or ${destinationPostalCode}`);
      }

      console.log('📍 Area IDs found:', {
        origin: { id: originArea.id, name: originArea.name },
        destination: { id: destinationArea.id, name: destinationArea.name }
      });

      // FIXED: Enhanced request body formats with proper required fields
      const requestBodies = [
        // Format 1: With area IDs - Skip this format since it consistently fails
        // Moving to Format 2 directly since it works
        null, // Placeholder to maintain array indexing
        // Format 2: With postal codes and expanded courier list
        {
          origin_postal_code: originPostalCode,
          destination_postal_code: destinationPostalCode,
          couriers: "jne,jnt,sicepat,pos,ninja,rpx",
          items: [{
            name: "Package",
            value: packageData.value,
            weight: packageData.weight,
            height: packageData.height,
            length: packageData.length,
            width: packageData.width,
            quantity: 1
          }]
        },
        // Format 3: Simple fallback format
        {
          origin_postal_code: originPostalCode,
          destination_postal_code: destinationPostalCode,
          items: [{
            name: "Package",
            value: packageData.value,
            weight: packageData.weight,
            height: packageData.height,
            length: packageData.length,
            width: packageData.width,
            quantity: 1
          }]
        }
      ];

      let validRates: ShippingRate[] = [];
      let lastError: Error | null = null;

      // Try each request format
      for (let i = 0; i < requestBodies.length; i++) {
        const requestBody = requestBodies[i];
        
        // Skip null formats (disabled formats)
        if (requestBody === null) {
          console.log(`🚫 Skipping Format ${i + 1} (disabled due to consistent failures)`);
          continue;
        }
        
        const formatName = ['Area IDs (Disabled)', 'Postal Code + Couriers', 'Simple Fallback'][i];
        
        console.log(`🚀 Trying ${formatName} (Format ${i + 1})...`);
        
        try {
          const data = await makeBiteshipRequest(`${BITESHIP_BASE_URL}/rates/couriers`, {
            method: 'POST',
            body: JSON.stringify(requestBody)
          });

          if (!data.success) {
            console.log(`⚠️ ${formatName} not compatible:`, data.error || data.message);
            lastError = new Error(`${formatName}: ${data.error || data.message || 'Unknown error'}`);
            continue;
          }

          // Process successful response
          validRates = await processRealBiteshipResponse(data);
          
          if (validRates.length > 0) {
            console.log(`✅ SUCCESS! ${formatName} worked perfectly - Found ${validRates.length} rates`);
            console.log('📥 Response structure:', Object.keys(data));
            break;
          } else {
            console.log(`⚠️ ${formatName} responded but no rates available`);
            continue;
          }

        } catch (error) {
          console.log(`⚠️ ${formatName} failed:`, error.message.includes('400') ? 'Bad request - missing parameters' : error.message);
          lastError = error as Error;
          continue;
        }
      }

      // If no format worked, try fallback with simple endpoint
      if (validRates.length === 0) {
        console.log('🔄 Trying fallback /rates endpoint as last resort...');
        
        try {
          const fallbackBody = {
            origin_postal_code: originPostalCode,
            destination_postal_code: destinationPostalCode,
            type: "delivery",
            items: [{
              name: "Package",
              description: "Order package",
              category: "general", 
              value: packageData.value,
              weight: packageData.weight,
              height: packageData.height,
              length: packageData.length,
              width: packageData.width,
              quantity: 1
            }]
          };

          const data = await makeBiteshipRequest(`${BITESHIP_BASE_URL}/rates`, {
            method: 'POST',
            body: JSON.stringify(fallbackBody)
          });

          if (data.success) {
            validRates = await processRealBiteshipResponse(data);
            if (validRates.length > 0) {
              console.log(`✅ Fallback endpoint worked! Found ${validRates.length} rates`);
            }
          }
        } catch (fallbackError) {
          console.log('⚠️ Fallback endpoint also failed:', fallbackError.message);
        }
      }
      
      if (validRates.length === 0) {
        console.error('❌ No valid rates found after all attempts');
        throw lastError || new Error('No shipping rates available for this route');
      }

      // Sort by price (ascending)
      validRates.sort((a, b) => a.price - b.price);

      console.log(`🎯 Found ${validRates.length} real shipping rates:`);
      validRates.forEach((rate, index) => {
        console.log(`${index + 1}. ${rate.courier_name} ${rate.courier_service_name}: Rp ${rate.price.toLocaleString()} (${rate.duration})`);
      });

      // Cache the real results
      SHIPPING_CACHE.set(cacheKey, {
        data: validRates,
        timestamp: Date.now()
      });

      return validRates;

    } catch (error) {
      console.error('❌ Real Biteship API failed:', error);
      throw error;
    } finally {
      SHIPPING_REQUESTS.delete(cacheKey);
      console.log('🧹 Cleaning up requests and timers...');
    }
  })();

  SHIPPING_REQUESTS.set(cacheKey, requestPromise);
  return await requestPromise;
}

/**
 * Process REAL Biteship response from /rates/couriers endpoint with multiple format support
 */
async function processRealBiteshipResponse(data: any): Promise<ShippingRate[]> {
  const validRates: ShippingRate[] = [];
  
 // console.log('📊 Analyzing real Biteship response structure...');
  
  // Biteship API memiliki berbagai struktur response tergantung endpoint
  const possibleRatesArrays = [
    data.pricing,        // Most common for /rates/couriers
    data.data, 
    data.rates,
    data.couriers,
    data.results,
    data.options,
    data.courier_pricing, // Alternative structure
    data.available_couriers
  ];

  let ratesData: any[] = [];
  let responseStructure = 'unknown';

  // Check for direct array in root
  if (Array.isArray(data) && data.length > 0) {
    ratesData = data;
    responseStructure = 'root_array';
    console.log(`📊 Found rates in root array (${ratesData.length} items)`);
  } else {
    // Check nested arrays
    for (let i = 0; i < possibleRatesArrays.length; i++) {
      const arrayName = ['pricing', 'data', 'rates', 'couriers', 'results', 'options', 'courier_pricing', 'available_couriers'][i];
      if (Array.isArray(possibleRatesArrays[i]) && possibleRatesArrays[i].length > 0) {
        ratesData = possibleRatesArrays[i];
        responseStructure = arrayName;
        console.log(`📊 Found rates in data.${arrayName} (${ratesData.length} items)`);
        break;
      }
    }
  }

  // If still no array found, check for nested objects that might contain arrays
  if (ratesData.length === 0) {
    console.log('🔍 No direct arrays found, checking nested objects...');
    
    const checkNestedObjects = (obj: any, path: string = '') => {
      if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          
          if (Array.isArray(value) && value.length > 0) {
            console.log(`📊 Found potential rates array at ${currentPath} (${value.length} items)`);
            
            // Check if array contains rate-like objects
            const firstItem = value[0];
            if (firstItem && typeof firstItem === 'object' && 
                (firstItem.price || firstItem.cost || firstItem.courier_name || firstItem.company)) {
              ratesData = value;
              responseStructure = currentPath;
              return true;
            }
          } else if (typeof value === 'object' && value !== null) {
            if (checkNestedObjects(value, currentPath)) {
              return true;
            }
          }
        }
      }
      return false;
    };

    checkNestedObjects(data);
  }

  if (ratesData.length === 0) {
    console.error('❌ No rates array found in response');
    console.error('Response keys available:', Object.keys(data));
    return [];
  }

  console.log(`📊 Processing ${ratesData.length} items from ${responseStructure}...`);

  ratesData.forEach((item, index) => {
    // Extract courier name from various possible fields
    const courierName = item.courier_name || item.company || item.courier || item.name || 
                       item.courier_company || item.shipping_company;
    
    // Extract service name from various possible fields
    const serviceName = item.courier_service_name || item.service_name || item.type || 
                       item.service || item.service_type || item.courier_type || 
                       item.product || item.product_name;
    
    // Extract price from various possible fields
    const price = item.price || item.final_price || item.total_price || item.cost || 
                 item.rate || item.shipping_cost || item.fee;
    
    // Check availability
    const available = item.available !== false && item.status !== 'unavailable';

    if (!courierName || !serviceName) {
      console.log(`  ❌ Item ${index + 1}: Missing courier or service name`);
      return;
    }

    if (!price || price <= 0) {
      console.log(`  ❌ Item ${index + 1}: Invalid price`);
      return;
    }

    if (!available) {
      console.log(`  ❌ Item ${index + 1}: Not available`);
      return;
    }

    // Extract duration from various possible fields
    let duration = item.duration || item.etd || item.estimated_delivery || 
                  item.delivery_time || item.est_delivery || item.lead_time;
    
    if (!duration && item.min_day && item.max_day) {
      if (item.min_day === item.max_day) {
        duration = `${item.min_day} hari`;
      } else {
        duration = `${item.min_day} - ${item.max_day} hari`;
      }
    } else if (!duration && item.delivery_estimate) {
      duration = item.delivery_estimate;
    } else if (!duration) {
      duration = '1-3 hari kerja';
    }

    // Generate codes if not provided
    const courierCode = item.courier_code || 
                       courierName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    
    const serviceCode = item.courier_service_code || 
                       `${courierCode}_${serviceName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;

    const shippingRate: ShippingRate = {
      courier_name: courierName,
      courier_code: courierCode,
      courier_service_name: serviceName,
      courier_service_code: serviceCode,
      price: Math.round(Number(price)),
      duration: String(duration),
      description: item.description || `${courierName} ${serviceName}`,
      insurance_fee: item.insurance_fee || item.insurance_cost || item.insurance || 0
    };

    validRates.push(shippingRate);
    console.log(`  ✅ Added: ${shippingRate.courier_name} ${shippingRate.courier_service_name} - Rp ${shippingRate.price.toLocaleString()}`);
  });

  console.log(`📊 Total valid rates extracted: ${validRates.length}`);
  
  return validRates;
}

/**
 * Get available couriers between two areas
 */
export async function getAvailableCouriers(originAreaId: string, destinationAreaId: string): Promise<CourierAvailability[]> {
  try {
    const data = await makeBiteshipRequest(`${BITESHIP_BASE_URL}/couriers/check-coverage`, {
      method: 'POST', 
      body: JSON.stringify({
        origin_area_id: originAreaId,
        destination_area_id: destinationAreaId,
        type: "delivery"
      })
    });
    
    if (data.success && data.couriers) {
      return data.couriers;
    }
    return [];
  } catch (err: any) {
    console.error('Error checking courier availability:', err);
    return [];
  }
}

/**
 * Search areas by keyword (city name, postal code, etc.)
 */
export async function searchAreas(keyword: string, limit: number = 10): Promise<BiteshipArea[]> {
  const cacheKey = `search_${keyword}_${limit}`;
  
  const cached = AREA_CACHE.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < AREA_CACHE_DURATION) {
    console.log('Using cached area search results');
    return cached.data;
  }

  if (AREA_REQUESTS.has(cacheKey)) {
    console.log('Waiting for existing area search request');
    return await AREA_REQUESTS.get(cacheKey);
  }

  const requestPromise = (async () => {
    try {
      console.log('Searching areas with keyword:', keyword);
      
      const url = `${BITESHIP_BASE_URL}/maps/areas?countries=ID&input=${encodeURIComponent(keyword)}&limit=${limit}`;
      const data = await makeBiteshipRequest(url);

      if (data.success && data.areas && Array.isArray(data.areas)) {
        const processedAreas = data.areas.map((area: any) => {
          const postalCode = extractPostalCode(area);
          
          return {
            id: area.id || '',
            name: area.name || '',
            country_code: area.country_code || 'ID',
            country_name: area.country_name || 'Indonesia',
            postal_code: postalCode,
            administrative_division_level_1_name: area.administrative_division_level_1_name || '',
            administrative_division_level_2_name: area.administrative_division_level_2_name || '',
            administrative_division_level_3_name: area.administrative_division_level_3_name || '',
            administrative_division_level_4_name: area.administrative_division_level_4_name || '',
            administrative_division_level_1_type: area.administrative_division_level_1_type || 'province',
            administrative_division_level_2_type: area.administrative_division_level_2_type || 'city',
            administrative_division_level_3_type: area.administrative_division_level_3_type || 'district',
            administrative_division_level_4_type: area.administrative_division_level_4_type || 'village'
          } as BiteshipArea;
        });

        AREA_CACHE.set(cacheKey, {
          data: processedAreas,
          timestamp: Date.now()
        });

        console.log(`Found ${processedAreas.length} areas`);
        return processedAreas;
      }

      console.log('No areas found or invalid response structure');
      return [];
    } finally {
      AREA_REQUESTS.delete(cacheKey);
    }
  })();

  AREA_REQUESTS.set(cacheKey, requestPromise);
  return await requestPromise;
}

/**
 * Validate Indonesian postal code format
 */
export function isValidIndonesianPostalCode(postalCode: string): boolean {
  const postalCodeRegex = /^\d{5}$/;
  return postalCodeRegex.test(postalCode);
}

/**
 * Format area display name
 */
export function formatAreaName(area: BiteshipArea): string {
  const parts = [];
  
  if (area.administrative_division_level_4_name) {
    parts.push(area.administrative_division_level_4_name);
  }
  if (area.administrative_division_level_3_name) {
    parts.push(area.administrative_division_level_3_name);
  }
  if (area.administrative_division_level_2_name) {
    parts.push(area.administrative_division_level_2_name);
  }
  if (area.administrative_division_level_1_name) {
    parts.push(area.administrative_division_level_1_name);
  }
  
  if (area.postal_code && area.postal_code.trim() !== '') {
    return `${parts.join(', ')} (${area.postal_code})`;
  }
  
  return parts.join(', ');
}

// Cache cleanup - Enhanced with better logging
setInterval(() => {
  const now = Date.now();
  let cleanedArea = 0;
  let cleanedShipping = 0;
  
  for (const [key, value] of AREA_CACHE.entries()) {
    if (now - value.timestamp > AREA_CACHE_DURATION) {
      AREA_CACHE.delete(key);
      cleanedArea++;
    }
  }
  
  for (const [key, value] of SHIPPING_CACHE.entries()) {
    if (now - value.timestamp > SHIPPING_CACHE_DURATION) {
      SHIPPING_CACHE.delete(key);
      cleanedShipping++;
    }
  }
  
  if (cleanedArea > 0 || cleanedShipping > 0) {
    console.log(`🧹 Biteship cache cleanup: Areas(${cleanedArea}), Shipping Rates(${cleanedShipping})`);
  }
}, 2 * 60 * 1000); // Every 2 minutes