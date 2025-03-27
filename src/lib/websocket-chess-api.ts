/**
 * WebSocket implementation for Chess API
 * Provides real-time analysis using Chess-API.com's WebSocket interface
 */

export interface ChessApiRequestOptions {
  fen: string;
  depth?: number;
  variants?: number;
  maxThinkingTime?: number;
  searchmoves?: string;
  taskId?: string;
}

export interface ChessApiResponse {
  text: string;
  eval: number;
  move: string;
  fen: string;
  depth: number;
  winChance: number;
  continuationArr?: string[];
  mate?: number | null;
  centipawns?: string;
  san?: string;
  lan?: string;
  turn?: string;
  color?: string;
  piece?: string;
  flags?: string;
  isCapture?: boolean;
  isCastling?: boolean;
  isPromotion?: boolean;
  from?: string;
  to?: string;
  fromNumeric?: string;
  toNumeric?: string;
  taskId?: string;
  time?: number;
  type?: string;
  pv?: any[];
}

export interface WebSocketClientOptions {
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: ChessApiResponse) => void;
  onBestMove?: (message: ChessApiResponse) => void;
  reconnectTimeout?: number;
}

/**
 * A class to manage WebSocket connections to Chess-API.com
 */
export class ChessApiWebSocketClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private connecting = false;
  private reconnectTimeout: number;
  private url = 'wss://chess-api.com/v1';
  private callbacks: {
    onConnect?: () => void;
    onDisconnect?: () => void;
    onError?: (error: Event) => void;
    onMessage?: (message: ChessApiResponse) => void;
    onBestMove?: (message: ChessApiResponse) => void;
  };
  private pendingRequests: Map<string, ChessApiRequestOptions> = new Map();
  private requestTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(options: WebSocketClientOptions = {}) {
    this.callbacks = {
      onConnect: options.onConnect,
      onDisconnect: options.onDisconnect,
      onError: options.onError,
      onMessage: options.onMessage,
      onBestMove: options.onBestMove
    };
    this.reconnectTimeout = options.reconnectTimeout || 5000;
  }

  /**
   * Connect to the Chess API WebSocket server
   */
  public connect(): Promise<void> {
    if (this.connected) {
      return Promise.resolve();
    }

    if (this.connecting) {
      return new Promise((resolve) => {
        // Check connection status periodically
        const checkConnection = setInterval(() => {
          if (this.connected) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
      });
    }

    this.connecting = true;
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          console.log('WebSocket connection established with Chess API');
          this.connected = true;
          this.connecting = false;
          
          if (this.callbacks.onConnect) {
            this.callbacks.onConnect();
          }
          
          // Retry any pending requests
          this.retryPendingRequests();
          
          resolve();
        };
        
        this.ws.onclose = () => {
          console.log('WebSocket connection closed');
          this.connected = false;
          this.connecting = false;
          
          if (this.callbacks.onDisconnect) {
            this.callbacks.onDisconnect();
          }
          
          // Attempt to reconnect after timeout
          setTimeout(() => this.reconnect(), this.reconnectTimeout);
        };
        
        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          
          if (this.callbacks.onError) {
            this.callbacks.onError(error);
          }
          
          if (!this.connected) {
            this.connecting = false;
            reject(error);
          }
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data) as ChessApiResponse;
            
            if (message.taskId && this.requestTimeouts.has(message.taskId)) {
              // Clear timeout for this request
              clearTimeout(this.requestTimeouts.get(message.taskId));
              this.requestTimeouts.delete(message.taskId);
            }
            
            // If this is a bestmove response, remove from pending requests
            if (message.type === 'bestmove' && message.taskId) {
              this.pendingRequests.delete(message.taskId);
            }
            
            // Call appropriate callback based on message type
            if (message.type === 'bestmove' && this.callbacks.onBestMove) {
              this.callbacks.onBestMove(message);
            } else if (this.callbacks.onMessage) {
              this.callbacks.onMessage(message);
            }
          } catch (err) {
            console.error('Error parsing WebSocket message:', err);
          }
        };
      } catch (err) {
        this.connecting = false;
        reject(err);
      }
    });
  }

  /**
   * Reconnect to the WebSocket server
   */
  private reconnect(): void {
    if (!this.connected && !this.connecting) {
      console.log('Attempting to reconnect to Chess API WebSocket...');
      this.connect().catch(err => {
        console.error('Failed to reconnect:', err);
      });
    }
  }

  /**
   * Retry any pending requests after reconnection
   */
  private retryPendingRequests(): void {
    if (!this.connected || !this.ws) return;
    
    console.log(`Retrying ${this.pendingRequests.size} pending requests`);
    
    this.pendingRequests.forEach((request, taskId) => {
      this.sendRequest(request);
    });
  }

  /**
   * Send a position for analysis
   */
  public async analyze(options: ChessApiRequestOptions): Promise<void> {
    // Generate a unique task ID if not provided
    const taskId = options.taskId || Math.random().toString(36).substring(2, 12);
    const requestWithTaskId = { ...options, taskId };
    
    // Store in pending requests
    this.pendingRequests.set(taskId, requestWithTaskId);
    
    // Set a timeout for this request
    const timeout = setTimeout(() => {
      console.warn(`Request ${taskId} timed out`);
      this.pendingRequests.delete(taskId);
      this.requestTimeouts.delete(taskId);
    }, 10000); // 10 second timeout
    
    this.requestTimeouts.set(taskId, timeout);
    
    // Ensure connection is established before sending
    await this.connect();
    
    return this.sendRequest(requestWithTaskId);
  }
  
  /**
   * Internal method to send a request over WebSocket
   */
  private sendRequest(options: ChessApiRequestOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.ws) {
        reject(new Error('WebSocket not connected'));
        return;
      }
      
      try {
        this.ws.send(JSON.stringify(options));
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Close the WebSocket connection
   */
  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
      this.connecting = false;
      
      // Clear all pending requests and timeouts
      this.requestTimeouts.forEach(timeout => clearTimeout(timeout));
      this.requestTimeouts.clear();
      this.pendingRequests.clear();
    }
  }

  /**
   * Check if WebSocket is connected
   */
  public isConnected(): boolean {
    return this.connected;
  }

  public updateCallbacks(options: WebSocketClientOptions): void {
    if (options.onConnect) this.callbacks.onConnect = options.onConnect;
    if (options.onDisconnect) this.callbacks.onDisconnect = options.onDisconnect;
    if (options.onError) this.callbacks.onError = options.onError;
    if (options.onMessage) this.callbacks.onMessage = options.onMessage;
    if (options.onBestMove) this.callbacks.onBestMove = options.onBestMove;
  }
}

