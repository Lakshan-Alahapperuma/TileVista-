import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { IOsposRawStock, OsposStockResponseDto } from './dto/ospos-product.dto';

/**
 * Typed interface for a single OSPOS item returned by GET /api/items.
 */
export interface OsposItem {
  item_id: number;
  name: string;
  category: string;
  category_id: number | null;
  subcategory_id: number | null;
  sku: string;
  description: string;
  price: number;
  quantity: number;
  reorder_level: number;
  brand?: string | null;
  color?: string | null;
  material?: string | null;
  attributes?: Record<string, string>;
}

/**
 * Service to handle communications with the external OSPOS (Open Source Point Of Sale) API.
 * Safely fetches live stock inventory data and provides it to the core orders and analytics modules.
 */
@Injectable()
export class OsposIntegrationService {
  private readonly logger = new Logger(OsposIntegrationService.name);

  // Read OSPOS API configurations from environment variables or use the specified defaults
  private readonly baseUrl = process.env.OSPOS_API_BASE_URL || 'http://localhost/ospos/public/index.php/api/tilevista';
  private readonly secretToken = process.env.OSPOS_API_TOKEN || 'Bearer your_secret_ospos_token_here';

  constructor(private readonly httpService: HttpService) {}

  /**
   * Fetches all active items from OSPOS with their live quantities.
   * Returns an empty array and logs a warning if OSPOS is unreachable.
   */
  async fetchAllItems(): Promise<OsposItem[]> {
    try {
      this.logger.log('Fetching full item catalog from OSPOS...');
      const response = await firstValueFrom(
        this.httpService.get<any[]>(`${this.baseUrl}/items`, {
          headers: {
            Authorization: this.secretToken,
            Accept: 'application/json',
          },
        }),
      );
      this.logger.log(`Received ${response.data.length} items from OSPOS.`);
      return response.data.map((item) => ({
        ...item,
        brand: item.attributes?.Brand || item.brand || null,
        color: item.attributes?.Color || item.color || null,
        material: item.attributes?.Material || item.material || null,
      }));
    } catch (error) {
      this.logger.error(`Failed to fetch item catalog from OSPOS: ${error.message}`);
      return [];
    }
  }

  /**
   * Fetches the category tree from OSPOS.
   */
  async fetchCategories(): Promise<any[]> {
    try {
      this.logger.log('Fetching category tree from OSPOS...');
      const response = await firstValueFrom(
        this.httpService.get<any[]>(`${this.baseUrl}/categories`, {
          headers: {
            Authorization: this.secretToken,
            Accept: 'application/json',
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch categories from OSPOS: ${error.message}`);
      return [];
    }
  }


  /**
   * Safe method to fetch live stock from OSPOS for a specific item ID.
   * If OSPOS is offline, it returns a safe fallback stock level of 0 with isStaleData = true.
   * 
   * @param itemId The numerical item ID
   * @returns A promise resolving to an object containing stock level and stale flag
   */
  async fetchLiveStockFromPos(itemId: number): Promise<{ stock: number; isStaleData: boolean }> {
    const details = await this.fetchStockDetailsFromPos(itemId);
    return {
      stock: details.stock,
      isStaleData: details.isStaleData,
    };
  }

  /**
   * Fetches the complete, normalized stock details (including low stock calculation) from OSPOS.
   * Seamlessly catches and logs network or server disruptions and returns a fallback state.
   * 
   * @param itemId The numerical item ID
   * @returns A promise resolving to the OsposStockResponseDto
   */
  async fetchStockDetailsFromPos(itemId: number): Promise<OsposStockResponseDto> {
    try {
      this.logger.log(`Initiating live inventory request to OSPOS for item: ${itemId}`);
      
      const response = await firstValueFrom(
        this.httpService.get<IOsposRawStock>(
          `${this.baseUrl}/stock/${itemId}`,
          {
            headers: {
              'Authorization': this.secretToken,
              'Accept': 'application/json',
            },
          },
        ),
      );

      if (!response || !response.data) {
        throw new Error('OSPOS API returned an empty or invalid response payload');
      }

      // Normalize raw high-precision string values to typed primitives using the DTO constructor
      const dto = new OsposStockResponseDto(response.data, undefined, false);

      this.logger.log(`Successfully fetched and normalized stock for item ${itemId}: ${dto.stock} (isLowStock: ${dto.isLowStock})`);
      return dto;

    } catch (error) {
      // Catch network disruption, timeout, refusal, or internal server error seamlessly and log it
      this.logger.error(
        `OSPOS network disruption or integration failure for item ID ${itemId}. Returning fallback stock level. Error: ${error.message}`,
        error.stack,
      );

      // Return a safe fallback DTO with stock 0 and isStaleData = true
      return new OsposStockResponseDto(
        {
          item_id: itemId,
          quantity_available: 0,
        },
        undefined,
        true, // isStaleData: true
      );
    }
  }

  /**
   * Fetches paginated sales line-item data from OSPOS with computed revenue, tax, and EAV attributes.
   */
  async fetchSalesData(params: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
    locationId?: number;
    saleType?: number;
  } = {}): Promise<OsposSalesResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params.startDate) queryParams.set('start_date', params.startDate);
      if (params.endDate) queryParams.set('end_date', params.endDate);
      if (params.page) queryParams.set('page', String(params.page));
      if (params.limit) queryParams.set('limit', String(params.limit));
      if (params.locationId) queryParams.set('location_id', String(params.locationId));
      if (params.saleType !== undefined) queryParams.set('sale_type', String(params.saleType));

      const url = `${this.baseUrl}/sales?${queryParams.toString()}`;
      this.logger.log(`Fetching sales data from OSPOS: ${url}`);

      const response = await firstValueFrom(
        this.httpService.get<OsposSalesResponse>(url, {
          headers: {
            Authorization: this.secretToken,
            Accept: 'application/json',
          },
          timeout: 15000, // Sales queries may be heavier
        }),
      );

      this.logger.log(
        `Received ${response.data.data.length} sale line items (page ${response.data.pagination.page}/${response.data.pagination.totalPages})`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch sales data from OSPOS: ${error.message}`);
      return {
        data: [],
        pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
        summary: { totalRevenue: 0, totalTax: 0, totalTransactions: 0, dateRange: { start: '', end: '' } },
      };
    }
  }
}

/**
 * Typed interface for a single sale line item returned by GET /api/tilevista/sales.
 */
export interface OsposSaleItem {
  sale_id: number;
  sale_time: string;
  sale_type: number;
  customer_id: number | null;
  employee_id: number;
  invoice_number: string | null;
  item_id: number;
  line: number;
  item_name: string;
  sku: string;
  category: string;
  category_id: number | null;
  quantity_purchased: number;
  item_cost_price: number;
  item_unit_price: number;
  discount: number;
  discount_type: number;
  line_total: number;
  tax_amount: number;
  current_stock: number;
  reorder_level: number;
  brand: string | null;
  color: string | null;
  material: string | null;
}

export interface OsposSalesResponse {
  data: OsposSaleItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    totalRevenue: number;
    totalTax: number;
    totalTransactions: number;
    dateRange: { start: string; end: string };
  };
}
