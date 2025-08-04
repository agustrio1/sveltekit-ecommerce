// routes/api/areas/+server.ts

import { json, error, type RequestEvent } from '@sveltejs/kit';
import { 
  getAreaByPostalCode, 
  searchAreas, 
  getAvailableCouriers,
  isValidIndonesianPostalCode,
  formatAreaName
} from '$lib/server/biteship-utils';

// GET - Search areas by keyword or get area by postal code
export async function GET({ url }: RequestEvent) {
  try {
    const keyword = url.searchParams.get('search');
    const postalCode = url.searchParams.get('postal_code');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    console.log('Areas API called with:', { keyword, postalCode, limit });

    if (postalCode) {
      // Get specific area by postal code
      if (!isValidIndonesianPostalCode(postalCode)) {
        return json({
          success: false,
          message: 'Invalid Indonesian postal code format. Must be 5 digits.',
          data: null
        }, { status: 400 });
      }

      console.log('Searching by postal code:', postalCode);
      const area = await getAreaByPostalCode(postalCode);
      
      if (!area) {
        // If no area found, create a basic area with the postal code
        return json({
          success: true,
          data: {
            id: '',
            name: `Area with postal code ${postalCode}`,
            country_code: 'ID',
            country_name: 'Indonesia',
            postal_code: postalCode,
            administrative_division_level_1_name: '',
            administrative_division_level_2_name: '',
            administrative_division_level_3_name: '',
            administrative_division_level_4_name: '',
            administrative_division_level_1_type: 'province',
            administrative_division_level_2_type: 'city',
            administrative_division_level_3_type: 'district',
            administrative_division_level_4_type: 'village',
            formatted_name: `Postal Code ${postalCode}`
          }
        });
      }

      console.log('Found area:', area);
      return json({
        success: true,
        data: {
          ...area,
          formatted_name: formatAreaName(area)
        }
      });
    }

    if (keyword) {
      // Search areas by keyword
      if (keyword.length < 2) {
        return json({
          success: false,
          message: 'Search keyword must be at least 2 characters',
          data: []
        }, { status: 400 });
      }

      console.log('Searching areas with keyword:', keyword);
      const areas = await searchAreas(keyword, limit);
      
      console.log(`Found ${areas.length} areas`);
      
      // Process areas with formatted names
      const processedAreas = areas.map(area => {
        // If no postal code found, try to extract from name or use empty
        let postalCode = area.postal_code;
        if (!postalCode || postalCode.trim() === '') {
          const match = area.name.match(/(\d{5})/);
          postalCode = match ? match[1] : '';
        }

        return {
          ...area,
          postal_code: postalCode,
          formatted_name: formatAreaName({
            ...area,
            postal_code: postalCode
          })
        };
      });

      return json({
        success: true,
        count: processedAreas.length,
        data: processedAreas
      });
    }

    return json({
      success: false,
      message: 'Either search keyword or postal_code parameter is required',
      data: []
    }, { status: 400 });

  } catch (err: any) {
    console.error('Error in areas API:', err);
    
    // Handle specific errors
    if (err.message === 'Request timeout') {
      return json({
        success: false,
        message: 'Request timeout - please try again later',
        data: []
      }, { status: 408 });
    }

    return json({
      success: false,
      message: 'Failed to fetch area data. Please try again.',
      data: [],
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: 500 });
  }
}

// POST - Check courier availability between areas
export async function POST({ request }: RequestEvent) {
  try {
    const { origin_area_id, destination_area_id } = await request.json();

    if (!origin_area_id || !destination_area_id) {
      return json({
        success: false,
        message: 'Origin and destination area IDs are required',
        data: []
      }, { status: 400 });
    }

    console.log('Checking courier availability:', { origin_area_id, destination_area_id });
    const couriers = await getAvailableCouriers(origin_area_id, destination_area_id);
    
    console.log(`Found ${couriers.length} available couriers`);
    
    return json({
      success: true,
      data: couriers
    });

  } catch (err: any) {
    console.error('Error checking courier availability:', err);
    
    if (err.message === 'Request timeout') {
      return json({
        success: false,
        message: 'Request timeout - please try again later',
        data: []
      }, { status: 408 });
    }

    return json({
      success: false,
      message: 'Failed to check courier availability',
      data: [],
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    }, { status: 500 });
  }
}