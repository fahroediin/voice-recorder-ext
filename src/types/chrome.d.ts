// Chrome Extension API type declarations
declare global {
  var chrome: {
    runtime: {
      onInstalled: {
        addListener(callback: () => void): void;
      };

      onMessage: {
        addListener(callback: (
          message: any,
          sender: any,
          sendResponse: (response?: any) => void
        ) => boolean | void | Promise<boolean>): void;
      };

      sendMessage(message: any): Promise<any>;
      sendMessage(message: any, callback: (response?: any) => void): void;

      getContexts(filter: {
        contextTypes?: string[];
        documentUrls?: string[];
      }): Promise<any[]>;

      getURL: (path: string) => string;

      lastError?: {
        message?: string;
      };

      id: string;
    };

    offscreen: {
      createDocument(options: {
        url: string;
        reasons: string[];
        justification: string;
      }): Promise<void>;
    };

    sidePanel: {
      open(options?: { tabId?: number; windowId?: number }): Promise<void>;
    };

    action: {
      onClicked: {
        addListener(callback: (tab: any) => void): void;
      };
    };

    identity: {
      getAuthToken(options?: {
        interactive?: boolean;
        scopes?: string[];
      }, callback?: (token: string) => void): void | Promise<string>;

      removeCachedAuthToken(options: {
        token: string;
      }): Promise<void>;
    };

    tabs: {
      create(options: { url: string }): Promise<void>;
    };

    storage: {
      local: {
        get(keys?: string | string[] | Record<string, any> | null): Promise<Record<string, any>>;
        set(items: Record<string, any>): Promise<void>;
      };
    };
  };
}

export {};