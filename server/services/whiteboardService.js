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

  // Save entire whiteboard state
  async saveWhiteboard(pages, currentPage) {
    try {
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
    } catch (error) {
      console.error('❌ Error saving whiteboard:', error);
      throw error;
    }
  }

  // Add element to specific page
  async addElement(pageNumber, element) {
    try {
      console.log(`📝 Adding element to page ${pageNumber}:`, element.type);
      
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
        console.log('✅ Element added to database');
      } else {
        console.log('⚠️  Element already exists in database');
      }
      
      return whiteboard;
    } catch (error) {
      console.error('❌ Error adding element:', error);
      throw error;
    }
  }

  // Update element on specific page
  async updateElement(pageNumber, element) {
    try {
      console.log(`🔄 Updating element on page ${pageNumber}:`, element.id);
      
      const whiteboard = await this.getWhiteboard();
      
      // Find the page
      const page = whiteboard.pages.find(p => p.pageNumber === pageNumber);
      if (!page) {
        console.log('⚠️  Page not found for update');
        return whiteboard;
      }
      
      // Update the element
      const elementIndex = page.elements.findIndex(el => el.id === element.id);
      if (elementIndex !== -1) {
        page.elements[elementIndex] = element;
        await whiteboard.save();
        console.log('✅ Element updated in database');
      } else {
        console.log('⚠️  Element not found for update');
      }
      
      return whiteboard;
    } catch (error) {
      console.error('❌ Error updating element:', error);
      throw error;
    }
  }

  // Delete element from specific page
  async deleteElement(pageNumber, elementId) {
    try {
      console.log(`🗑️  Deleting element from page ${pageNumber}:`, elementId);
      
      const whiteboard = await this.getWhiteboard();
      
      // Find the page
      const page = whiteboard.pages.find(p => p.pageNumber === pageNumber);
      if (!page) {
        console.log('⚠️  Page not found for delete');
        return whiteboard;
      }
      
      // Remove the element
      page.elements = page.elements.filter(el => el.id !== elementId);
      await whiteboard.save();
      console.log('✅ Element deleted from database');
      
      return whiteboard;
    } catch (error) {
      console.error('❌ Error deleting element:', error);
      throw error;
    }
  }

  // Clear specific page
  async clearPage(pageNumber) {
    try {
      console.log(`🧹 Clearing page ${pageNumber}`);
      
      const whiteboard = await this.getWhiteboard();
      
      // Find the page
      const page = whiteboard.pages.find(p => p.pageNumber === pageNumber);
      if (page) {
        page.elements = [];
        await whiteboard.save();
        console.log('✅ Page cleared in database');
      }
      
      return whiteboard;
    } catch (error) {
      console.error('❌ Error clearing page:', error);
      throw error;
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

  // Batch update multiple elements (for performance optimization)
  async batchUpdate(updates) {
    try {
      console.log(`🔄 Processing batch update with ${updates.length} operations`);
      
      const whiteboard = await this.getWhiteboard();
      
      for (const update of updates) {
        const page = whiteboard.pages.find(p => p.pageNumber === update.page) || 
                    (() => {
                      const newPage = { pageNumber: update.page, elements: [] };
                      whiteboard.pages.push(newPage);
                      return newPage;
                    })();
        
        switch (update.type) {
          case 'add':
            if (!page.elements.some(el => el.id === update.element.id)) {
              page.elements.push(update.element);
            }
            break;
          case 'update':
            const elementIndex = page.elements.findIndex(el => el.id === update.element.id);
            if (elementIndex !== -1) {
              page.elements[elementIndex] = update.element;
            }
            break;
          case 'delete':
            page.elements = page.elements.filter(el => el.id !== update.elementId);
            break;
          case 'clear':
            page.elements = [];
            break;
        }
      }
      
      await whiteboard.save();
      console.log('✅ Batch update completed');
      
      return whiteboard;
    } catch (error) {
      console.error('❌ Error in batch update:', error);
      throw error;
    }
  }
}

module.exports = WhiteboardService; 