class TransactionGrid {
    constructor() {
        this.rawData = [];
        this.filteredData = [];
        this.currentPage = 1;
        this.pageSize = 10;
        this.sortCol = 'date';
        this.sortAsc = false;
    }

    // --- NEW: Set the default 3-month window ---
    setDefaultDateRange() {
        const today = new Date();
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(today.getMonth() - 3);

        // Format dates to YYYY-MM-DD for HTML inputs
        const formatDate = (date) => date.toISOString().split('T')[0];

        document.getElementById('filterStartDate').value = formatDate(threeMonthsAgo);
        document.getElementById('filterEndDate').value = formatDate(today);
    }

    async loadData() {
        try {
            // Set the dates in the UI before fetching data
            this.setDefaultDateRange();

            const response = await window.fetchSecureAPI('/api/transactions');

            if (response && response.transactions) {
                this.rawData = response.transactions;
                this.applyFilters();
            } else {
                this.rawData = [];
                this.renderTable();
            }
        } catch (error) {
            console.error("Failed to load table data:", error);
        }
    }

    // --- UPDATED: The Filter Engine now handles Date Ranges ---
    applyFilters() {
        const globalTerm = document.getElementById('globalSearch').value.toLowerCase();

        // Grab the start and end dates
        const startDate = document.getElementById('filterStartDate').value;
        const endDate = document.getElementById('filterEndDate').value;

        const descFilter = document.getElementById('filterDesc').value.toLowerCase();
        const catFilter = document.getElementById('filterCategory').value;

        this.filteredData = this.rawData.filter(row => {
            // 1. Date Range Logic
            let matchDate = true;
            if (startDate && row.date < startDate) matchDate = false;
            if (endDate && row.date > endDate) matchDate = false;

            // 2. Specific Filters
            const matchDesc = !descFilter || row.description.toLowerCase().includes(descFilter);
            const matchCat = !catFilter || row.category === catFilter;

            // 3. Global Filter
            const matchGlobal = !globalTerm || Object.values(row).some(val =>
                String(val).toLowerCase().includes(globalTerm)
            );

            return matchDate && matchDesc && matchCat && matchGlobal;
        });

        this.currentPage = 1;
        this.executeSort();
    }

    // 3. Sorting Logic
    sortBy(column) {
        if (this.sortCol === column) {
            this.sortAsc = !this.sortAsc; // Toggle direction
        } else {
            this.sortCol = column;
            this.sortAsc = true; // Default to ascending on new column
        }
        this.executeSort();
    }

    executeSort() {
        this.filteredData.sort((a, b) => {
            let valA = a[this.sortCol];
            let valB = b[this.sortCol];

            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();

            if (valA < valB) return this.sortAsc ? -1 : 1;
            if (valA > valB) return this.sortAsc ? 1 : -1;
            return 0;
        });

        this.renderTable();
    }

    // 4. UI Rendering (Table + Pagination)
    renderTable() {
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';

        // Calculate pagination slice
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + parseInt(this.pageSize);
        const paginatedItems = this.filteredData.slice(startIndex, endIndex);

      // --- NEW: Dynamic Empty States ---
        if (paginatedItems.length === 0) {
            // Check if the user is actively searching for something
            const isSearching = document.getElementById('globalSearch').value !== '' ||
                                document.getElementById('filterDesc').value !== '' ||
                                document.getElementById('filterCategory').value !== '';

            if (isSearching) {
                // State 1: Search yielded no results
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" style="padding: 40px; text-align: center; color: var(--text-secondary);">
                            <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;"></i>
                            <h4 style="margin: 0 0 5px 0;">No exact matches found</h4>
                            <p style="margin: 0;">Try adjusting your search filters or date range.</p>
                        </td>
                    </tr>
                `;
            } else {
                // State 2: Completely Empty (Clean Slate Animation)
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" style="padding: 0;">
                            <div class="empty-state-card" style="border: none; background: transparent; padding: 60px 20px;">
                                <i class="fas fa-seedling empty-state-icon" style="font-size: 4rem; color: #27ae60; animation: subtlePulse 2.5s infinite ease-in-out;"></i>
                                <h3 style="font-size: 1.4rem; margin-top: 15px;">A Clean Slate!</h3>
                                <p style="white-space: normal; line-height: 1.6; max-width: 450px; margin: 10px auto; color: var(--text-secondary);">
                                    You don't have anything to display at this time. Keep up the great work of uploading your statements and get into a practice of tracking your financial spending to boost your score!
                                </p>
                                <a href="/upload" class="btn-save" style="margin-top: 20px; text-decoration: none; display: inline-block;">
                                    <i class="fas fa-cloud-upload-alt"></i> Upload Statements
                                </a>
                            </div>
                        </td>
                    </tr>
                `;
            }
        }
        paginatedItems.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.date}</td>
                <td class="align-right">$${parseFloat(row.amount).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                <td>${row.description}</td>
                <td>${row.category}</td>
            `;
            tbody.appendChild(tr);
        });

        this.renderPagination(startIndex, endIndex);
    }

    renderPagination(startIndex, endIndex) {
        const total = this.filteredData.length;
        const actualEnd = Math.min(endIndex, total);

        // Update Info Text
        document.getElementById('tableInfo').innerText =
            `Showing ${total === 0 ? 0 : startIndex + 1} to ${actualEnd} of ${total} entries`;

        // Update Buttons
        const totalPages = Math.ceil(total / this.pageSize);
        const paginationContainer = document.getElementById('paginationControls');
        paginationContainer.innerHTML = '';

        // Prev Button
        const prevBtn = document.createElement('button');
        prevBtn.innerText = 'Previous';
        prevBtn.disabled = this.currentPage === 1;
        prevBtn.onclick = () => { this.currentPage--; this.renderTable(); };
        paginationContainer.appendChild(prevBtn);

        // Page Numbers (Simplified for layout)
        for (let i = 1; i <= totalPages; i++) {
            const pageBtn = document.createElement('button');
            pageBtn.innerText = i;
            if (i === this.currentPage) pageBtn.classList.add('active');
            pageBtn.onclick = () => { this.currentPage = i; this.renderTable(); };
            paginationContainer.appendChild(pageBtn);
        }

        // Next Button
        const nextBtn = document.createElement('button');
        nextBtn.innerText = 'Next';
        nextBtn.disabled = this.currentPage === totalPages || totalPages === 0;
        nextBtn.onclick = () => { this.currentPage++; this.renderTable(); };
        paginationContainer.appendChild(nextBtn);
    }

    // 5. Utilities
    changePageSize() {
        this.pageSize = document.getElementById('pageSize').value;
        this.currentPage = 1;
        this.renderTable();
    }

   // --- UPDATED: Clear Filters now acts as an "All Time" search ---
    clearFilters() {
        document.getElementById('globalSearch').value = '';
        document.getElementById('filterStartDate').value = ''; // Clears start date
        document.getElementById('filterEndDate').value = '';   // Clears end date
        document.getElementById('filterDesc').value = '';
        document.getElementById('filterCategory').value = '';

        // Re-run the filters with blank dates, which searches the whole database!
        this.applyFilters();
    }
}

// Initialize the grid when the DOM loads
const grid = new TransactionGrid();
document.addEventListener('DOMContentLoaded', () => {
    grid.loadData();
});