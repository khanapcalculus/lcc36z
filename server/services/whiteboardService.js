const Whiteboard = require('../models/Whiteboard');

class WhiteboardService {
  constructor() {
    this.WHITEBOARD_ID = 'default-whiteboard'; // For now, single whiteboard
  }

  // Get or create whiteboard
  async getWhiteboard() {
    try {
      let whiteboard = await Whiteboard.findOne({ whiteboardId: this.WHITEBOARD_ID });
      
      if (!whiteboard) {
        console.log('📝 Creating new whiteboard...');
        whiteboard = new Whiteboard({
          whiteboardId: this.WHITEBOARD_ID,
          pages: [{ pageNumber: 1, elements: [] }],
          currentPage: 1
        });
        await whiteboard.save();
        console.log('✅ New whiteboard created');
      }
      
      return whiteboard;
    } catch (error) {
      console.error('❌ Error getting whiteboard:', error);
      throw error;
    }
  }

  // Retry function for handling version conflicts
  async retryOperation(operation, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (error.name === 'VersionError' && attempt < maxRetries) {
          console.log(`⚠️ Version conflict, retrying... (attempt ${attempt}/${maxRetries})`);
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 50 * attempt));
          continue;
        }
        throw error;
      }
    }
  }

  // Save entire whiteboard state with retry logic
  async saveWhiteboard(pages, currentPage) {
    return this.retryOperation(async () => {
      console.log('💾 Saving whiteboard state...');
      
      // Convert pages object to array format for MongoDB
      const pagesArray = Object.keys(pages).map(pageNum => ({
        pageNumber: parseInt(pageNum),
        elements: pages[pageNum] || []
      }));

      const whiteboard = await this.getWhiteboard();
      whiteboard.pages = pagesArray;
      whiteboard.currentPage = currentPage;
      
      await whiteboard.save();
      console.log('✅ Whiteboard saved successfully');
      
      return whiteboard;
    });
  }

  // Add element using atomic operation
  async addElement(pageNumber, element) {
    try {
      console.log(`📝 Adding element to page ${pageNumber}:`, element.type);
      
      // Use atomic operation to avoid version conflicts
      const result = await Whiteboard.findOneAndUpdate(
        { 
          whiteboardId: this.WHITEBOARD_ID,
          'pages.pageNumber': pageNumber,
          'pages.elements.id': { $ne: element.id } // Only add if element doesn't exist
        },
        { 
          $push: { 'pages.$.elements': element },
          $set: { lastModified: new Date() }
        },
        { 
          new: true,
          upsert: false
        }
      );

      if (result) {
        console.log('✅ Element added to database');
        return result;
      } else {
        // Page doesn't exist or element already exists, handle manually
        return this.retryOperation(async () => {
          const whiteboard = await this.getWhiteboard();
          
          // Find or create the page
          let page = whiteboard.pages.find(p => p.pageNumber === pageNumber);
          if (!page) {
            page = { pageNumber, elements: [] };
            whiteboard.pages.push(page);
          }
          
          // Add element if it doesn't already exist
          const elementExists = page.elements.some(el => el.id === element.id);
          if (!elementExists) {
            page.elements.push(element);
            await whiteboard.save();
            console.log('✅ Element added to database (fallback)');
          } else {
            console.log('⚠️ Element already exists in database');
          }
          
          return whiteboard;
        });
      }
    } catch (error) {
      console.error('❌ Error adding element:', error);
      // Don't throw error, just log it to prevent breaking the app
      return null;
    }
  }

  // Update element using atomic operation
  async updateElement(pageNumber, element) {
    try {
      console.log(`🔄 Updating element on page ${pageNumber}:`, element.id);
      
      // Use atomic operation to avoid version conflicts
      const result = await Whiteboard.findOneAndUpdate(
        { 
          whiteboardId: this.WHITEBOARD_ID,
          'pages.pageNumber': pageNumber,
          'pages.elements.id': element.id
        },
        { 
          $set: { 
            'pages.$[page].elements.$[elem]': element,
            lastModified: new Date()
          }
        },
        { 
          arrayFilters: [
            { 'page.pageNumber': pageNumber },
            { 'elem.id': element.id }
          ],
          new: true
        }
      );

      if (result) {
        console.log('✅ Element updated in database');
        return result;
      } else {
        console.log('⚠️ Element not found for update');
        return await this.getWhiteboard();
      }
    } catch (error) {
      console.error('❌ Error updating element:', error);
      // Don't throw error, just log it to prevent breaking the app
      return null;
    }
  }

  // Delete element using atomic operation
  async deleteElement(pageNumber, elementId) {
    try {
      console.log(`🗑️ Deleting element from page ${pageNumber}:`, elementId);
      
      // Use atomic operation to avoid version conflicts
      const result = await Whiteboard.findOneAndUpdate(
        { 
          whiteboardId: this.WHITEBOARD_ID,
          'pages.pageNumber': pageNumber
        },
        { 
          $pull: { 'pages.$.elements': { id: elementId } },
          $set: { lastModified: new Date() }
        },
        { new: true }
      );

      if (result) {
        console.log('✅ Element deleted from database');
        return result;
      } else {
        console.log('⚠️ Page not found for delete');
        return await this.getWhiteboard();
      }
    } catch (error) {
      console.error('❌ Error deleting element:', error);
      // Don't throw error, just log it to prevent breaking the app
      return null;
    }
  }

  // Clear specific page using atomic operation
  async clearPage(pageNumber) {
    try {
      console.log(`🧹 Clearing page ${pageNumber}`);
      
      // Use atomic operation to avoid version conflicts
      const result = await Whiteboard.findOneAndUpdate(
        { 
          whiteboardId: this.WHITEBOARD_ID,
          'pages.pageNumber': pageNumber
        },
        { 
          $set: { 
            'pages.$.elements': [],
            lastModified: new Date()
          }
        },
        { new: true }
      );

      if (result) {
        console.log('✅ Page cleared in database');
        return result;
      } else {
        console.log('⚠️ Page not found for clear');
        return await this.getWhiteboard();
      }
    } catch (error) {
      console.error('❌ Error clearing page:', error);
      // Don't throw error, just log it to prevent breaking the app
      return null;
    }
  }

  // Convert database format to client format
  convertToClientFormat(whiteboard) {
    const pages = {};
    
    whiteboard.pages.forEach(page => {
      pages[page.pageNumber] = page.elements;
    });
    
    return {
      pages,
      currentPage: whiteboard.currentPage
    };
  }

  // Optimized batch update using atomic operations
  async batchUpdate(updates) {
    try {
      console.log(`🔄 Processing batch update with ${updates.length} operations`);
      
      // Group updates by type for better performance
      const addUpdates = updates.filter(u => u.type === 'add');
      const updateUpdates = updates.filter(u => u.type === 'update');
      const deleteUpdates = updates.filter(u => u.type === 'delete');
      const clearUpdates = updates.filter(u => u.type === 'clear');

      // Process each type of update
      for (const update of addUpdates) {
        await this.addElement(update.page, update.element);
      }

      for (const update of updateUpdates) {
        await this.updateElement(update.page, update.element);
      }

      for (const update of deleteUpdates) {
        await this.deleteElement(update.page, update.elementId);
      }

      for (const update of clearUpdates) {
        await this.clearPage(update.page);
      }
      
      console.log('✅ Batch update completed');
      return await this.getWhiteboard();
    } catch (error) {
      console.error('❌ Error in batch update:', error);
      // Don't throw error, just log it to prevent breaking the app
      return null;
    }
  }
}

module.exports = WhiteboardService; 