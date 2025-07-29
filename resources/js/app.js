// Global data arrays
        let customers = [];
        let transactions = [];
        let payments = [];

        // Counters for sequential IDs
        let idCounters = {
            customer: 0,
            transaction: 0,
            payment: 0
        };

        // --- Sorting and Search State ---
        // Changed default sort direction to 'desc' for all relevant sections
        let dashboardSortConfig = { column: 'name', direction: 'desc' }; // Changed to desc
        let customerSortConfig = { column: 'id', direction: 'desc' }; // Changed to sort by id desc for newest on top
        let transactionSortConfig = { column: 'date', direction: 'desc' };
        let paymentSortConfig = { column: 'date', direction: 'desc' };

        let dashboardSearchTerm = '';
        let customerSearchTerm = '';
        let transactionSearchTerm = '';
        let paymentSearchTerm = '';

        // --- Date Range Filter State ---
        let dashboardDateRange = { start: '', end: '' };
        let customerDateRange = { start: '', end: '' };
        let transactionDateRange = { start: '', end: '' };
        let paymentDateRange = { start: '', end: '' };
        let reportDateRange = { start: '', end: '' }; // New state for reports

        // --- Pagination State ---
        const itemsPerPage = 10;
        // Using objects to hold currentPage for mutable references
        let dashboardPaginationState = { currentPage: 1 };
        let customerPaginationState = { currentPage: 1 };
        let transactionPaginationState = { currentPage: 1 };
        let paymentPaginationState = { currentPage: 1 };

        // Chart instance
        let milkQuantityChartInstance = null;

        // --- Utility Functions ---

        /**
         * Generates a unique ID based on type (customer, transaction, payment)
         * and maintains a persistent sequential counter for each.
         * @param {string} type - The type of entity ('customer', 'transaction', 'payment').
         * @returns {string} The formatted sequential ID (e.g., "C01", "T15").
         */
        function generateId(type) {
            let prefix;
            let counterName;

            if (type === 'customer') {
                prefix = 'C';
                counterName = 'customer';
            } else if (type === 'transaction') {
                prefix = 'T';
                counterName = 'transaction';
            } else if (type === 'payment') {
                prefix = 'P';
                counterName = 'payment';
            } else {
                // Fallback for unexpected types, though should not happen with proper calls
                console.error("Invalid type for generateId:", type);
                return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); // Fallback to alphanumeric
            }

            idCounters[counterName]++;
            // Pad with leading zeros to at least 2 digits (C01, C02, ... C09, C10)
            // If numbers go beyond 99, it will naturally expand (C100, C101)
            const newId = `${prefix}${String(idCounters[counterName]).padStart(2, '0')}`;
            console.log(`Generated new ID for ${type}: ${newId}`);
            return newId;
        }

        /**
         * Initializes the ID counters by scanning existing data to find the highest sequential ID
         * for each type. This ensures new IDs continue the sequence correctly.
         */
        function initializeIdCounters() {
            let maxCustNum = 0;
            customers.forEach(c => {
                const match = c.id.match(/^C(\d+)$/);
                if (match) {
                    maxCustNum = Math.max(maxCustNum, parseInt(match[1], 10));
                }
            });
            idCounters.customer = maxCustNum;

            let maxTransNum = 0;
            transactions.forEach(t => {
                const match = t.id.match(/^T(\d+)$/);
                if (match) {
                    maxTransNum = Math.max(maxTransNum, parseInt(match[1], 10));
                }
            });
            idCounters.transaction = maxTransNum;

            let maxPayNum = 0;
            payments.forEach(p => {
                const match = p.id.match(/^P(\d+)$/);
                if (match) {
                    maxPayNum = Math.max(maxPayNum, parseInt(match[1], 10));
                }
            });
            idCounters.payment = maxPayNum;

            console.log('Initialized ID Counters:', idCounters);
        }

        // Function to format date for display
        function formatDate(dateString) {
            if (!dateString) return '';
            const date = new Date(dateString);
            return date.toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            });
        }

        // Function to format currency
        function formatCurrency(amount) {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
            }).format(amount);
        }

        /**
         * Filters data based on search term and date range.
         * @param {Array} data - The array of data to filter.
         * @param {string} searchTerm - The search term.
         * @param {Array<string>} fieldsToSearch - The fields to search within for the search term.
         * @param {Object} dateRange - Object with start and end date strings (YYYY-MM-DD).
         * @param {boolean} filterByActivity - If true, for customer/dashboard data, filters by activity within date range.
         * @returns {Array} The filtered data.
         */
        function filterData(data, searchTerm, fieldsToSearch, dateRange, filterByActivity = false) {
            console.log('filterData: Initial data:', JSON.parse(JSON.stringify(data)));
            console.log('filterData: Search Term:', searchTerm);
            console.log('filterData: Date Range:', dateRange);

            let filtered = data;
            const lowerCaseSearchTerm = searchTerm.toLowerCase();

            // Apply text search filter
            if (searchTerm) {
                filtered = filtered.filter(item => {
                    return fieldsToSearch.some(field => {
                        let value;
                        if (field === 'customerTypeDisplay') {
                            const customer = customers.find(c => c.id === item.customerId);
                            value = customer ? (customer.type === 'seller' ? 'Seller' : 'Buyer') : '';
                        } else if (field === 'customerName') {
                            const customer = customers.find(c => c.id === item.customerId);
                            value = customer ? customer.name : '';
                        } else {
                            value = item[field];
                        }

                        if (value === null || value === undefined) return false;

                        if (field === 'date') {
                            return formatDate(value).toLowerCase().includes(lowerCaseSearchTerm);
                        }

                        return String(value).toLowerCase().includes(lowerCaseSearchTerm);
                    });
                });
            }

            // Apply date range filter
            if (dateRange && (dateRange.start || dateRange.end)) {
                const startDate = dateRange.start ? new Date(dateRange.start + 'T00:00:00') : null;
                const endDate = dateRange.end ? new Date(dateRange.end + 'T23:59:59') : null;

                if (filterByActivity) {
                    // For Dashboard and Customers: filter by customer activity within the date range
                    const activeCustomerIds = new Set();
                    transactions.forEach(t => {
                        const transactionDate = new Date(t.date + 'T00:00:00');
                        if ((!startDate || transactionDate >= startDate) && (!endDate || transactionDate <= endDate)) {
                            activeCustomerIds.add(t.customerId);
                        }
                    });
                    payments.forEach(p => {
                        const paymentDate = new Date(p.date + 'T00:00:00');
                        if ((!startDate || paymentDate >= startDate) && (!endDate || paymentDate <= endDate)) {
                            activeCustomerIds.add(p.customerId);
                        }
                    });

                    filtered = filtered.filter(item => activeCustomerIds.has(item.id)); // item.id is customerId for balances/customers
                } else {
                    // For Transactions and Payments: filter items directly by their date
                    filtered = filtered.filter(item => {
                        const itemDate = new Date(item.date + 'T00:00:00');
                        return (!startDate || itemDate >= startDate) && (!endDate || itemDate <= endDate);
                    });
                }
            }
            console.log('filterData: Filtered data:', JSON.parse(JSON.stringify(filtered)));
            return filtered;
        }

        // --- Modal Logic ---
        const customModal = document.getElementById('customModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalMessage = document.getElementById('modalMessage');
        const modalConfirmBtn = document.getElementById('modalConfirmBtn');
        const modalCancelBtn = document.getElementById('modalCancelBtn');

        let onModalConfirmCallback = () => {};

        function showModal(title, message, onConfirm, confirmButtonText = 'Confirm', cancelButtonText = 'Cancel', confirmButtonClass = 'bg-red-600 hover:bg-red-700') {
            modalTitle.textContent = title;
            modalMessage.textContent = message;
            modalConfirmBtn.textContent = confirmButtonText;
            modalCancelBtn.textContent = cancelButtonText;

            // Reset and apply new class for confirm button
            modalConfirmBtn.className = `px-4 py-2 text-white rounded-md transition-colors ${confirmButtonClass}`;

            onModalConfirmCallback = onConfirm;
            customModal.classList.remove('hidden');
        }

        function hideModal() {
            customModal.classList.add('hidden');
        }

        modalConfirmBtn.addEventListener('click', () => {
            onModalConfirmCallback();
            hideModal();
        });

        modalCancelBtn.addEventListener('click', () => {
            hideModal();
        });

        // --- Data Persistence (LocalStorage Primary, JSON File Backup) ---

        /**
         * Saves all current data (customers, transactions, payments) to localStorage.
         * This is the primary persistence mechanism for easy access on reopening.
         */
        function saveData() {
            try {
                const customersJson = JSON.stringify(customers);
                const transactionsJson = JSON.stringify(transactions);
                const paymentsJson = JSON.stringify(payments);

                localStorage.setItem('milkTradeCustomers', customersJson);
                localStorage.setItem('milkTradeTransactions', transactionsJson);
                localStorage.setItem('milkTradePayments', paymentsJson);
                console.log('Data saved to localStorage successfully.');
                console.log('Customers in localStorage:', localStorage.getItem('milkTradeCustomers').length, 'bytes');
                console.log('Transactions in localStorage:', localStorage.getItem('milkTradeTransactions').length, 'bytes');
                console.log('Payments in localStorage:', localStorage.getItem('milkTradePayments').length, 'bytes');
            } catch (e) {
                console.error("Error saving data to localStorage:", e);
                showModal('Save Error', 'Could not save data to local storage. Please check browser settings and try again.', () => {});
            }
        }

        /**
         * Loads all data (customers, transactions, payments) from localStorage.
         * This is called on initial page load.
         */
        function loadData() {
            try {
                const loadedCustomers = localStorage.getItem('milkTradeCustomers');
                const loadedTransactions = localStorage.getItem('milkTradeTransactions');
                const loadedPayments = localStorage.getItem('milkTradePayments');

                customers = loadedCustomers ? JSON.parse(loadedCustomers) : [];
                transactions = loadedTransactions ? JSON.parse(loadedTransactions) : [];
                payments = loadedPayments ? JSON.parse(loadedPayments) : [];

                console.log('Data loaded from localStorage successfully.');
                console.log('Loaded Customers count:', customers.length);
                console.log('Loaded Transactions count:', transactions.length);
                console.log('Loaded Payments count:', payments.length);

                initializeIdCounters(); // Initialize counters after loading data
            } catch (e) {
                console.error("Error parsing localStorage data, initializing empty:", e);
                customers = [];
                transactions = [];
                payments = [];
                showModal('Load Error', 'Could not load data from local storage. Starting with empty data. This might be due to corrupted saved data.', () => {});
            }
        }

        /**
         * Exports all current data to a JSON file for backup.
         * This is a secondary backup mechanism.
         */
        function exportDataToJson() {
            const data = {
                customers: customers,
                transactions: transactions,
                payments: payments
            };
            const jsonString = JSON.stringify(data, null, 2); // Pretty print JSON

            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'milk_trade_data_backup.json'; // Renamed for clarity
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showModal('Export Complete', 'Your data has been exported to milk_trade_data_backup.json.', () => {}, 'OK', '', 'bg-blue-600 hover:bg-blue-700');
        }

        /**
         * Imports data from a selected JSON file, merging with current data.
         * This is a secondary recovery/import mechanism.
         */
        function importDataFromJson(event) {
            const file = event.target.files[0];
            if (!file) {
                showModal('Import Error', 'Please select a JSON file to import.', () => {}, 'OK', '', 'bg-blue-600 hover:bg-blue-700');
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (importedData.customers && importedData.transactions && importedData.payments) {

                        // Helper function to merge or add items based on ID
                        const mergeData = (existingArray, importedArray) => {
                            importedArray.forEach(importedItem => {
                                const existingIndex = existingArray.findIndex(item => item.id === importedItem.id);
                                if (existingIndex !== -1) {
                                    // Update existing item
                                    existingArray[existingIndex] = importedItem;
                                } else {
                                    // Add new item
                                    existingArray.push(importedItem);
                                }
                            });
                        };

                        mergeData(customers, importedData.customers);
                        mergeData(transactions, importedData.transactions);
                        mergeData(payments, importedData.payments);

                        saveData(); // Save merged data to localStorage
                        initializeIdCounters(); // Re-initialize counters after merging imported data
                        renderAllData();
                        showModal('Import Complete', 'Data successfully imported from file and merged with current data. Existing entries with matching IDs were updated, new entries were added.', () => {}, 'OK', '', 'bg-blue-600 hover:bg-blue-700');
                    } else {
                        showModal('Import Error', 'Invalid JSON file format. Missing expected data structures (customers, transactions, payments).', () => {}, 'OK', '', 'bg-blue-600 hover:bg-blue-700');
                    }
                } catch (error) {
                    console.error("Error parsing JSON file:", error);
                    showModal('Import Error', 'Failed to parse JSON file. Please ensure it is valid JSON.', () => {}, 'OK', '', 'bg-blue-600 hover:bg-blue-700');
                }
            };
            reader.onerror = () => {
                showModal('Import Error', 'Failed to read file.', () => {}, 'OK', '', 'bg-blue-600 hover:bg-blue-700');
            };
            reader.readAsText(file);
            // Clear the file input after reading
            event.target.value = '';
        }

        // --- Core Logic ---

        // Calculate Customer Balances
        function calculateBalances() {
            const balances = {};

            // Initialize balances for all customers
            customers.forEach(customer => {
                balances[customer.id] = {
                    id: customer.id, // Include ID for sorting/filtering
                    name: customer.name,
                    type: customer.type,
                    balance: 0, // Positive if customer owes you (buyer), Negative if you owe customer (seller)
                };
            });

            // Apply transactions to balances
            transactions.forEach(transaction => {
                if (balances[transaction.customerId]) {
                    const totalAmount = parseFloat(transaction.quantity) * parseFloat(transaction.rate);
                    // The 'type' in transaction object is now 'buy' or 'sell'
                    if (transaction.type === 'sell') {
                        balances[transaction.customerId].balance += totalAmount; // Buyer owes you
                    } else if (transaction.type === 'buy') {
                        balances[transaction.customerId].balance -= totalAmount; // You owe seller
                    }
                }
            });

            // Apply payments to balances
            payments.forEach(payment => {
                if (balances[payment.customerId]) {
                    const amount = parseFloat(payment.amount);
                    if (payment.type === 'received_from_buyer') {
                        balances[payment.customerId].balance -= amount; // Buyer paid you
                    } else if (payment.type === 'paid_to_seller') {
                        balances[payment.customerId].balance += amount;
                    }
                }
            });

            return Object.values(balances);
        }

        // --- Sorting Logic ---

        function sortData(data, sortConfig) {
            if (!sortConfig.column) return data;

            return [...data].sort((a, b) => {
                let valA = a[sortConfig.column];
                let valB = b[sortConfig.column];

                // Special handling for customer name/type in augmented data
                if (sortConfig.column === 'customerName') {
                    const customerA = customers.find(c => c.id === a.customerId);
                    const customerB = customers.find(c => c.id === b.customerId);
                    valA = customerA ? customerA.name : '';
                    valB = customerB ? customerB.name : '';
                } else if (sortConfig.column === 'customerTypeDisplay') {
                    const customerA = customers.find(c => c.id === a.customerId);
                    const customerB = customers.find(c => c.id === b.customerId);
                    valA = customerA ? (customerA.type === 'seller' ? 'Seller' : 'Buyer') : '';
                    valB = customerB ? (customerB.type === 'seller' ? 'Seller' : 'Buyer') : '';
                }

                // Ensure values are strings for date/id comparison
                if (sortConfig.column === 'date' || sortConfig.column === 'id') {
                    valA = String(valA);
                    valB = String(valB);
                } else if (typeof valA === 'string' && typeof valB === 'string') {
                    // For other string columns, convert to lowercase for case-insensitive sort
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
                }

                let comparisonResult = 0;
                if (valA < valB) {
                    comparisonResult = -1;
                } else if (valA > valB) {
                    comparisonResult = 1;
                }

                // Apply direction
                if (sortConfig.direction === 'desc') {
                    comparisonResult *= -1; // Reverse the order for descending
                }

                // Secondary sort for transactions and payments by ID if primary (date) is equal
                // This ensures "newest on top" even for entries on the same date
                if ((sortConfig.column === 'date' || sortConfig.column === 'id') && comparisonResult === 0) {
                    const idA = String(a.id);
                    const idB = String(b.id);
                    // For descending, a larger (newer) ID should come first
                    if (idA < idB) {
                        return 1;
                    } else if (idA > idB) {
                        return -1;
                    }
                }

                return comparisonResult;
            });
        }


        function updateSortHeaders(tableId, currentSortConfig) {
            const headers = document.querySelectorAll(`#${tableId} thead th.sortable-header`);
            headers.forEach(header => {
                header.classList.remove('asc', 'desc');
                if (header.dataset.sortColumn === currentSortConfig.column) {
                    header.classList.add(currentSortConfig.direction);
                }
            });
        }

        function handleSortClick(event, sortConfigRef, renderFunction, pageStateObject) {
            const column = event.currentTarget.dataset.sortColumn;
            if (!column) return;

            if (sortConfigRef.column === column) {
                sortConfigRef.direction = sortConfigRef.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortConfigRef.column = column;
                sortConfigRef.direction = 'asc';
            }
            pageStateObject.currentPage = 1; // Reset to first page on sort change
            renderFunction();
        }

        // --- Pagination Logic ---
        function renderPagination(totalItems, currentPage, paginationContainerId, renderFunction, pageStateObject) {
            const totalPages = Math.ceil(totalItems / itemsPerPage);
            const paginationContainer = document.getElementById(paginationContainerId);
            const entryCountSpan = paginationContainer.querySelector('span');

            // Clear previous pagination buttons, but keep the entry count span
            const existingButtons = paginationContainer.querySelectorAll('button');
            existingButtons.forEach(button => button.remove());
            const existingEllipses = paginationContainer.querySelectorAll('.pagination-ellipsis');
            existingEllipses.forEach(span => span.remove());

            if (totalPages <= 1) {
                entryCountSpan.textContent = `Total Entries: ${totalItems}`;
                return;
            }

            // Add Previous button
            const prevButton = document.createElement('button');
            prevButton.innerHTML = '&lt;'; // Left arrow
            prevButton.className = `px-3 py-1 rounded-md text-sm font-medium transition-colors border border-gray-300 ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-200'}`;
            prevButton.disabled = currentPage === 1;
            prevButton.addEventListener('click', () => {
                pageStateObject.currentPage = Math.max(1, currentPage - 1);
                renderFunction();
            });
            paginationContainer.appendChild(prevButton);

            // Logic for displaying page numbers
            const maxPagesToShow = 5; // Number of page buttons to show directly
            let startPage, endPage;

            if (totalPages <= maxPagesToShow + 2) { // If total pages are small enough to show most
                startPage = 1;
                endPage = totalPages;
            } else {
                // Determine the range of pages to show around the current page
                const pagesBefore = Math.floor((maxPagesToShow - 1) / 2);
                const pagesAfter = Math.ceil((maxPagesToShow - 1) / 2);

                startPage = currentPage - pagesBefore;
                endPage = currentPage + pagesAfter;

                if (startPage < 1) {
                    endPage += (1 - startPage);
                    startPage = 1;
                }

                if (endPage > totalPages) {
                    startPage -= (endPage - totalPages);
                    endPage = totalPages;
                }

                if (startPage > 1) {
                    // Always show first page and ellipsis if not near beginning
                    const firstPageButton = document.createElement('button');
                    firstPageButton.textContent = '1';
                    firstPageButton.className = `px-3 py-1 rounded-md text-sm font-medium transition-colors border border-gray-300 ${1 === currentPage ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'}`;
                    firstPageButton.addEventListener('click', () => {
                        pageStateObject.currentPage = 1;
                        renderFunction();
                    });
                    paginationContainer.appendChild(firstPageButton);

                    if (startPage > 2) { // Only show ellipsis if there's more than just page 1
                        const ellipsisSpan = document.createElement('span');
                        ellipsisSpan.textContent = '...';
                        ellipsisSpan.className = 'pagination-ellipsis px-2 py-1 text-gray-600';
                        paginationContainer.appendChild(ellipsisSpan);
                    }
                }
            }

            for (let i = startPage; i <= endPage; i++) {
                const button = document.createElement('button');
                button.textContent = i;
                button.className = `px-3 py-1 rounded-md text-sm font-medium transition-colors border border-gray-300 ${i === currentPage ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'}`;
                button.addEventListener('click', () => {
                    pageStateObject.currentPage = i;
                    renderFunction();
                });
                paginationContainer.appendChild(button);
            }

            if (endPage < totalPages) {
                if (endPage < totalPages - 1) { // Only show ellipsis if there's more than just the last page
                    const ellipsisSpan = document.createElement('span');
                    ellipsisSpan.textContent = '...';
                    ellipsisSpan.className = 'pagination-ellipsis px-2 py-1 text-gray-600';
                    paginationContainer.appendChild(ellipsisSpan);
                }
                // Always show last page
                const lastPageButton = document.createElement('button');
                lastPageButton.textContent = totalPages;
                lastPageButton.className = `px-3 py-1 rounded-md text-sm font-medium transition-colors border border-gray-300 ${totalPages === currentPage ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-200'}`;
                lastPageButton.addEventListener('click', () => {
                    pageStateObject.currentPage = totalPages;
                    renderFunction();
                });
                paginationContainer.appendChild(lastPageButton);
            }

            // Add Next button
            const nextButton = document.createElement('button');
            nextButton.innerHTML = '&gt;'; // Right arrow
            nextButton.className = `px-3 py-1 rounded-md text-sm font-medium transition-colors border border-gray-300 ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-200'}`;
            nextButton.disabled = currentPage === totalPages;
            nextButton.addEventListener('click', () => {
                pageStateObject.currentPage = Math.min(totalPages, currentPage + 1);
                renderFunction();
            });
            paginationContainer.appendChild(nextButton);

            entryCountSpan.textContent = `Total Entries: ${totalItems}`;
        }


        // --- Render Functions ---

        function renderDashboard() {
            let allBalances = calculateBalances(); // Get all balances first

            // Calculate total owed/you owe based on ALL balances (or filtered by date)
            let totalOwedToYou = 0;
            let totalYouOwe = 0;

            let balancesForTotals = allBalances;
            // Only apply date filter to totals if date range is present
            if (dashboardDateRange.start || dashboardDateRange.end) {
                 // Filter transactions and payments by date range
                const startDate = dashboardDateRange.start ? new Date(dashboardDateRange.start + 'T00:00:00') : null;
                const endDate = dashboardDateRange.end ? new Date(dashboardDateRange.end + 'T23:59:59') : null;

                const filteredTransactionsForTotals = transactions.filter(t => {
                    const transactionDate = new Date(t.date + 'T00:00:00');
                    return (!startDate || transactionDate >= startDate) && (!endDate || transactionDate <= endDate);
                });

                const filteredPaymentsForTotals = payments.filter(p => {
                    const paymentDate = new Date(p.date + 'T00:00:00');
                    return (!startDate || paymentDate >= startDate) && (!endDate || paymentDate <= endDate);
                });

                // Recalculate balances based on filtered transactions and payments
                const filteredBalancesMap = {};
                customers.forEach(customer => {
                    filteredBalancesMap[customer.id] = {
                        id: customer.id,
                        name: customer.name,
                        type: customer.type,
                        balance: 0,
                    };
                });

                filteredTransactionsForTotals.forEach(transaction => {
                    if (filteredBalancesMap[transaction.customerId]) {
                        const totalAmount = parseFloat(transaction.quantity) * parseFloat(transaction.rate);
                        if (transaction.type === 'sell') {
                            filteredBalancesMap[transaction.customerId].balance += totalAmount;
                        } else if (transaction.type === 'buy') {
                            filteredBalancesMap[transaction.customerId].balance -= totalAmount;
                        }
                    }
                });

                filteredPaymentsForTotals.forEach(payment => {
                    if (filteredBalancesMap[payment.customerId]) {
                        const amount = parseFloat(payment.amount);
                        if (payment.type === 'received_from_buyer') {
                            filteredBalancesMap[payment.customerId].balance -= amount;
                        } else if (payment.type === 'paid_to_seller') {
                            filteredBalancesMap[payment.customerId].balance += amount;
                        }
                    }
                });
                balancesForTotals = Object.values(filteredBalancesMap);
            }


            balancesForTotals.forEach(cb => {
                if (cb.balance < 0) {
                    totalYouOwe += Math.abs(cb.balance);
                } else if (cb.balance > 0) {
                    totalOwedToYou += cb.balance;
                }
            });

            document.getElementById('totalOwedToYou').textContent = formatCurrency(totalOwedToYou);
            document.getElementById('totalYouOwe').textContent = formatCurrency(totalYouOwe);


            // Now, filter and sort for the table display
            // The table should still filter by the dashboard date range and search term
            let filteredBalancesForTable = filterData(allBalances, dashboardSearchTerm, ['name', 'type', 'balance'], dashboardDateRange, true);
            let sortedBalancesForTable = sortData(filteredBalancesForTable, dashboardSortConfig);

            const startIndex = (dashboardPaginationState.currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedBalances = sortedBalancesForTable.slice(startIndex, endIndex);

            const dashboardBalancesTableBody = document.getElementById('dashboardBalancesTableBody');
            dashboardBalancesTableBody.innerHTML = ''; // Clear previous rows


            paginatedBalances.forEach(cb => {
                const row = dashboardBalancesTableBody.insertRow();
                row.className = 'hover:bg-gray-50';

                const nameCell = row.insertCell();
                nameCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900';
                nameCell.textContent = cb.name;

                const typeCell = row.insertCell();
                typeCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
                typeCell.textContent = cb.type === 'seller' ? 'Seller' : 'Buyer';

                const balanceCell = row.insertCell();
                balanceCell.className = `px-6 py-4 whitespace-nowrap text-sm font-semibold ${cb.balance > 0 ? 'text-green-600' : (cb.balance < 0 ? 'text-red-600' : 'text-gray-600')}`;
                balanceCell.textContent = formatCurrency(Math.abs(cb.balance));
                if (cb.balance < 0) {
                    balanceCell.textContent += ' (You owe)';
                } else if (cb.balance > 0) {
                    balanceCell.textContent += ' (Owed to you)';
                }
            });


            updateSortHeaders('dashboardSection', dashboardSortConfig);
            renderPagination(sortedBalancesForTable.length, dashboardPaginationState.currentPage, 'dashboardPagination', renderDashboard, dashboardPaginationState);
        }

        function renderCustomers() {
            let filteredCustomers = filterData(customers, customerSearchTerm, ['name', 'type', 'phone', 'defaultQuantity', 'defaultRate', 'defaultMilkType', 'id'], customerDateRange, true); // Filter by activity
            let sortedCustomers = sortData(filteredCustomers, customerSortConfig);

            const startIndex = (customerPaginationState.currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedCustomers = sortedCustomers.slice(startIndex, endIndex);

            const customersTableBody = document.getElementById('customersTableBody');
            customersTableBody.innerHTML = ''; // Clear previous rows

            paginatedCustomers.forEach(customer => {
                const row = customersTableBody.insertRow();
                row.className = 'hover:bg-gray-50';

                // ID Cell
                const idCell = row.insertCell();
                idCell.className = 'px-6 py-4 whitespace-nowrap text-xs text-gray-500';
                idCell.textContent = customer.id;

                const nameCell = row.insertCell();
                nameCell.className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900';
                nameCell.textContent = customer.name;

                const typeCell = row.insertCell();
                typeCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
                typeCell.textContent = customer.type === 'seller' ? 'Seller' : 'Buyer';

                const phoneCell = row.insertCell();
                phoneCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
                phoneCell.textContent = customer.phone || 'N/A';

                // New cells for default transaction values
                const defaultQuantityCell = row.insertCell();
                defaultQuantityCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
                defaultQuantityCell.textContent = customer.defaultQuantity !== undefined ? parseFloat(customer.defaultQuantity).toFixed(2) : 'N/A';

                const defaultRateCell = row.insertCell();
                defaultRateCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
                defaultRateCell.textContent = customer.defaultRate !== undefined ? formatCurrency(parseFloat(customer.defaultRate)) : 'N/A';

                const defaultMilkTypeCell = row.insertCell();
                defaultMilkTypeCell.className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
                defaultMilkTypeCell.textContent = customer.defaultMilkType || 'N/A';


                const actionsCell = row.insertCell();
                actionsCell.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium';
                const editButton = document.createElement('button');
                editButton.textContent = 'Edit';
                editButton.className = 'text-blue-600 hover:text-blue-900 mr-3';
                editButton.onclick = () => editCustomer(customer.id);
                actionsCell.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.className = 'text-red-600 hover:text-red-900';
                deleteButton.onclick = () => deleteCustomer(customer.id);
                actionsCell.appendChild(deleteButton);
            });

            updateSortHeaders('customersSection', customerSortConfig);
            renderPagination(sortedCustomers.length, customerPaginationState.currentPage, 'customersPagination', renderCustomers, customerPaginationState);
        }

        function renderTransactions() {
            // Augment transactions with customer data for filtering/sorting
            const augmentedTransactions = transactions.map(t => {
                const customer = customers.find(c => c.id === t.customerId);
                return {
                    ...t,
                    customerName: customer ? customer.name : 'Unknown',
                    customerTypeDisplay: customer ? (customer.type === 'seller' ? 'Seller' : 'Buyer') : 'N/A',
                    totalAmount: parseFloat(t.quantity) * parseFloat(t.rate)
                };
            });

            console.log('Transactions before sort:', JSON.parse(JSON.stringify(augmentedTransactions))); // Deep copy for logging
            let filteredTransactions = filterData(augmentedTransactions, transactionSearchTerm, ['date', 'customerName', 'customerTypeDisplay', 'quantity', 'rate', 'milkType', 'shift', 'totalAmount', 'id'], transactionDateRange);
            let sortedTransactions = sortData(filteredTransactions, transactionSortConfig);
            console.log('Transactions after sort:', JSON.parse(JSON.stringify(sortedTransactions))); // Deep copy for logging

            // Calculate totals for summary row
            let totalBuffaloQuantity = 0;
            let totalBuffaloAmount = 0;
            let totalCowQuantity = 0;
            let totalCowAmount = 0;

            filteredTransactions.forEach(t => {
                if (t.milkType === 'Buffalo') {
                    totalBuffaloQuantity += parseFloat(t.quantity);
                    totalBuffaloAmount += parseFloat(t.totalAmount);
                } else if (t.milkType === 'Cow') {
                    totalCowQuantity += parseFloat(t.quantity);
                    totalCowAmount += parseFloat(t.totalAmount);
                }
            });


            const startIndex = (transactionPaginationState.currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex);

            const transactionsTableBody = document.getElementById('transactionsTableBody');
            transactionsTableBody.innerHTML = ''; // Clear previous rows

            paginatedTransactions.forEach(transaction => {
                const row = transactionsTableBody.insertRow();
                row.className = 'hover:bg-gray-50';

                // ID Cell
                row.insertCell().className = 'px-6 py-4 whitespace-nowrap text-xs text-gray-500';
                row.cells[0].textContent = transaction.id;

                row.insertCell().className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500'; // Date
                row.cells[1].textContent = formatDate(transaction.date);

                row.insertCell().className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900'; // Customer Name
                row.cells[2].textContent = transaction.customerName;

                row.insertCell().className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500'; // Customer Type (formerly Transaction Type)
                row.cells[3].textContent = transaction.customerTypeDisplay; // Display customer type here

                row.insertCell().className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500'; // Quantity
                row.cells[4].textContent = parseFloat(transaction.quantity).toFixed(2);

                row.insertCell().className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500'; // Rate
                row.cells[5].textContent = formatCurrency(parseFloat(transaction.rate));

                row.insertCell().className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500'; // Milk Type
                row.cells[6].textContent = transaction.milkType || 'N/A';

                row.insertCell().className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500'; // Shift
                row.cells[7].textContent = transaction.shift || 'N/A';

                row.insertCell().className = 'px-6 py-4 whitespace-nowrap text-sm font-semibold'; // Total Amount
                row.cells[8].textContent = formatCurrency(transaction.totalAmount);

                const actionsCell = row.insertCell();
                actionsCell.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium';
                const editButton = document.createElement('button');
                editButton.textContent = 'Edit';
                editButton.className = 'text-blue-600 hover:text-blue-900 mr-3';
                editButton.onclick = () => editTransaction(transaction.id);
                actionsCell.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.className = 'text-red-600 hover:text-red-900';
                deleteButton.onclick = () => deleteTransaction(transaction.id);
                actionsCell.appendChild(deleteButton);
            });

            // Add summary row for Buffalo Milk
            const buffaloSummaryRow = transactionsTableBody.insertRow();
            buffaloSummaryRow.className = 'bg-blue-50 font-bold';
            buffaloSummaryRow.insertCell().colSpan = 4; // Span across ID, Date, Customer, Customer Type
            buffaloSummaryRow.cells[0].className = 'px-6 py-3 text-right text-sm text-blue-800';
            buffaloSummaryRow.cells[0].textContent = 'Total Buffalo Milk:';
            buffaloSummaryRow.insertCell().className = 'px-6 py-3 text-sm text-blue-800';
            buffaloSummaryRow.cells[1].textContent = totalBuffaloQuantity.toFixed(2) + ' L';
            buffaloSummaryRow.insertCell().colSpan = 3; // Span across Rate, Milk Type, Shift
            buffaloSummaryRow.cells[2].className = 'px-6 py-3'; // Empty cell for alignment
            buffaloSummaryRow.insertCell().className = 'px-6 py-3 text-sm text-blue-800';
            buffaloSummaryRow.cells[3].textContent = formatCurrency(totalBuffaloAmount);
            buffaloSummaryRow.insertCell().className = 'px-6 py-3'; // Empty cell for actions

            // Add summary row for Cow Milk
            const cowSummaryRow = transactionsTableBody.insertRow();
            cowSummaryRow.className = 'bg-green-50 font-bold';
            cowSummaryRow.insertCell().colSpan = 4; // Span across ID, Date, Customer, Customer Type
            cowSummaryRow.cells[0].className = 'px-6 py-3 text-right text-sm text-green-800';
            cowSummaryRow.cells[0].textContent = 'Total Cow Milk:';
            cowSummaryRow.insertCell().className = 'px-6 py-3 text-sm text-green-800';
            cowSummaryRow.cells[1].textContent = totalCowQuantity.toFixed(2) + ' L';
            cowSummaryRow.insertCell().colSpan = 3; // Span across Rate, Milk Type, Shift
            cowSummaryRow.cells[2].className = 'px-6 py-3'; // Empty cell for alignment
            cowSummaryRow.insertCell().className = 'px-6 py-3 text-sm text-green-800';
            cowSummaryRow.cells[3].textContent = formatCurrency(totalCowAmount);
            cowSummaryRow.insertCell().className = 'px-6 py-3'; // Empty cell for actions


            updateSortHeaders('transactionsSection', transactionSortConfig);
            renderPagination(sortedTransactions.length, transactionPaginationState.currentPage, 'transactionsPagination', renderTransactions, transactionPaginationState);
        }

        function renderPayments() {
            // Augment payments with customer data for filtering/sorting
            const augmentedPayments = payments.map(p => {
                const customer = customers.find(c => c.id === p.customerId);
                return {
                    ...p,
                    customerName: customer ? customer.name : 'Unknown',
                    // 'type' is already in payments as 'paid_to_seller'/'received_from_buyer'
                };
            });

            console.log('Payments before sort:', JSON.parse(JSON.stringify(augmentedPayments))); // Deep copy for logging
            let filteredPayments = filterData(augmentedPayments, paymentSearchTerm, ['date', 'customerName', 'type', 'amount', 'id'], paymentDateRange);
            let sortedPayments = sortData(filteredPayments, paymentSortConfig);
            console.log('Payments after sort:', JSON.parse(JSON.stringify(sortedPayments))); // Deep copy for logging

            const startIndex = (paymentPaginationState.currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedPayments = sortedPayments.slice(startIndex, endIndex);

            const paymentsTableBody = document.getElementById('paymentsTableBody');
            paymentsTableBody.innerHTML = ''; // Clear previous rows

            paginatedPayments.forEach(payment => {
                const row = paymentsTableBody.insertRow();
                row.className = 'hover:bg-gray-50';

                // ID Cell
                row.insertCell().className = 'px-6 py-4 whitespace-nowrap text-xs text-gray-500';
                row.cells[0].textContent = payment.id;

                row.insertCell().className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
                row.cells[1].textContent = formatDate(payment.date);

                row.insertCell().className = 'px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900';
                row.cells[2].textContent = payment.customerName;

                row.insertCell().className = 'px-6 py-4 whitespace-nowrap text-sm text-gray-500';
                row.cells[3].textContent = payment.type === 'paid_to_seller' ? 'Paid to Seller' : 'Received from Buyer';

                row.insertCell().className = 'px-6 py-4 whitespace-nowrap text-sm font-semibold';
                row.cells[4].textContent = formatCurrency(parseFloat(payment.amount));

                const actionsCell = row.insertCell();
                actionsCell.className = 'px-6 py-4 whitespace-nowrap text-right text-sm font-medium';
                const editButton = document.createElement('button');
                editButton.textContent = 'Edit';
                editButton.className = 'text-blue-600 hover:text-blue-900 mr-3';
                editButton.onclick = () => editPayment(payment.id);
                actionsCell.appendChild(editButton);

                const deleteButton = document.createElement('button');
                deleteButton.textContent = 'Delete';
                deleteButton.className = 'text-red-600 hover:text-red-900';
                deleteButton.onclick = () => deletePayment(payment.id);
                actionsCell.appendChild(deleteButton);
            });
            updateSortHeaders('paymentsSection', paymentSortConfig);
            renderPagination(sortedPayments.length, paymentPaginationState.currentPage, 'paymentsPagination', renderPayments, paymentPaginationState);
        }

        /**
         * Generates report data based on the selected date range.
         * @param {string} startDateString - Start date in YYYY-MM-DD format.
         * @param {string} endDateString - End date in YYYY-MM-DD format.
         * @returns {Object} An object containing summary data and chart data.
         */
        function generateReportData(startDateString, endDateString) {
            let totalMilkBought = 0;
            let totalMilkSold = 0;
            let totalPaymentsMade = 0;
            let totalPaymentsReceived = 0;
            let totalMilkBoughtValue = 0;
            let totalMilkSoldValue = 0;

            const dailyMilkData = {}; // { 'YYYY-MM-DD': { bought: 0, sold: 0 } }

            const startDate = startDateString ? new Date(startDateString + 'T00:00:00') : null;
            const endDate = endDateString ? new Date(endDateString + 'T23:59:59') : null;

            // Filter transactions and payments by date range
            const filteredTransactions = transactions.filter(t => {
                const transactionDate = new Date(t.date + 'T00:00:00');
                return (!startDate || transactionDate >= startDate) && (!endDate || transactionDate <= endDate);
            });

            const filteredPayments = payments.filter(p => {
                const paymentDate = new Date(p.date + 'T00:00:00');
                return (!startDate || paymentDate >= startDate) && (!endDate || paymentDate <= endDate);
            });

            filteredTransactions.forEach(t => {
                const quantity = parseFloat(t.quantity);
                const rate = parseFloat(t.rate);
                const value = quantity * rate;

                if (t.type === 'buy') {
                    totalMilkBought += quantity;
                    totalMilkBoughtValue += value;
                } else if (t.type === 'sell') {
                    totalMilkSold += quantity;
                    totalMilkSoldValue += value;
                }

                // Aggregate for chart data
                if (!dailyMilkData[t.date]) {
                    dailyMilkData[t.date] = { bought: 0, sold: 0 };
                }
                if (t.type === 'buy') {
                    dailyMilkData[t.date].bought += quantity;
                } else if (t.type === 'sell') {
                    dailyMilkData[t.date].sold += quantity;
                }
            });

            filteredPayments.forEach(p => {
                const amount = parseFloat(p.amount);
                if (p.type === 'paid_to_seller') {
                    totalPaymentsMade += amount;
                } else if (p.type === 'received_from_buyer') {
                    totalPaymentsReceived += amount;
                }
            });

            const grossProfitLoss = totalMilkSoldValue - totalMilkBoughtValue;

            // Prepare data for chart
            const chartLabels = Object.keys(dailyMilkData).sort();
            const chartBoughtData = chartLabels.map(date => dailyMilkData[date].bought);
            const chartSoldData = chartLabels.map(date => dailyMilkData[date].sold);

            return {
                totalMilkBought,
                totalMilkSold,
                totalPaymentsMade,
                totalPaymentsReceived,
                grossProfitLoss,
                chartData: {
                    labels: chartLabels,
                    bought: chartBoughtData,
                    sold: chartSoldData
                }
            };
        }

        function renderReports() {
            const reportStartDate = document.getElementById('reportStartDate').value;
            const reportEndDate = document.getElementById('reportEndDate').value;

            const reportData = generateReportData(reportStartDate, reportEndDate);

            document.getElementById('totalMilkBought').textContent = `${reportData.totalMilkBought.toFixed(2)} L`;
            document.getElementById('totalMilkSold').textContent = `${reportData.totalMilkSold.toFixed(2)} L`;
            document.getElementById('totalPaymentsMade').textContent = formatCurrency(reportData.totalPaymentsMade);
            document.getElementById('totalPaymentsReceived').textContent = formatCurrency(reportData.totalPaymentsReceived);
            document.getElementById('grossProfitLoss').textContent = formatCurrency(reportData.grossProfitLoss);

            // Update Chart
            const ctx = document.getElementById('milkQuantityChart').getContext('2d');
            const chartNoDataMessage = document.getElementById('chartNoDataMessage');

            if (reportData.chartData.labels.length === 0) {
                if (milkQuantityChartInstance) {
                    milkQuantityChartInstance.destroy();
                    milkQuantityChartInstance = null;
                }
                chartNoDataMessage.classList.remove('hidden');
            } else {
                chartNoDataMessage.classList.add('hidden');
                if (milkQuantityChartInstance) {
                    milkQuantityChartInstance.data.labels = reportData.chartData.labels;
                    milkQuantityChartInstance.data.datasets[0].data = reportData.chartData.bought;
                    milkQuantityChartInstance.data.datasets[1].data = reportData.chartData.sold;
                    milkQuantityChartInstance.update();
                } else {
                    milkQuantityChartInstance = new Chart(ctx, {
                        type: 'bar',
                        data: {
                            labels: reportData.chartData.labels,
                            datasets: [{
                                label: 'Milk Bought (L)',
                                data: reportData.chartData.bought,
                                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                                borderColor: 'rgba(75, 192, 192, 1)',
                                borderWidth: 1
                            }, {
                                label: 'Milk Sold (L)',
                                data: reportData.chartData.sold,
                                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                                borderColor: 'rgba(255, 99, 132, 1)',
                                borderWidth: 1
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                                title: {
                                    display: true,
                                    text: 'Daily Milk Quantity Bought vs. Sold'
                                }
                            },
                            scales: {
                                x: {
                                    title: {
                                        display: true,
                                        text: 'Date'
                                    }
                                },
                                y: {
                                    beginAtZero: true,
                                    title: {
                                        display: true,
                                        text: 'Quantity (Liters)'
                                    }
                                }
                            }
                        }
                    });
                }
            }
        }

        // Master render function to update all sections
        function renderAllData() {
            renderCustomers();
            renderTransactions();
            renderPayments();
            renderDashboard();
            renderReports(); // Call renderReports as well
        }

        // --- Form Handling & CRUD Operations ---

        // Customer Form
        const customerForm = document.getElementById('customerForm');
        customerForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = document.getElementById('customerId').value;
            const name = document.getElementById('customerName').value.trim();
            const type = document.getElementById('customerType').value;
            const phone = document.getElementById('customerPhone').value.trim();
            const defaultQuantity = parseFloat(document.getElementById('defaultQuantity').value);
            const defaultRate = parseFloat(document.getElementById('defaultRate').value);
            const defaultMilkType = document.getElementById('defaultMilkType').value;


            if (!name || !type) {
                showModal('Input Error', 'Customer Name and Type are required.', () => {}, 'OK', '', 'bg-blue-600 hover:bg-blue-700');
                return;
            }

            if (id) {
                // Update existing customer
                const index = customers.findIndex(c => c.id === id);
                if (index !== -1) {
                    customers[index] = { ...customers[index], name, type, phone, defaultQuantity, defaultRate, defaultMilkType };
                }
            } else {
                // Add new customer
                customers.push({ id: generateId('customer'), name, type, phone, defaultQuantity, defaultRate, defaultMilkType });
            }
            customerForm.reset();
            document.getElementById('customerId').value = ''; // Clear hidden ID
            saveData(); // Save data to localStorage after changes
            customerPaginationState.currentPage = 1; // Reset to first page after adding/updating
            renderAllData();
        });

        function editCustomer(id) {
            const customer = customers.find(c => c.id === id);
            if (customer) {
                document.getElementById('customerId').value = customer.id;
                document.getElementById('customerName').value = customer.name;
                document.getElementById('customerType').value = customer.type;
                document.getElementById('customerPhone').value = customer.phone;
                document.getElementById('defaultQuantity').value = customer.defaultQuantity !== undefined ? customer.defaultQuantity : 0;
                document.getElementById('defaultRate').value = customer.defaultRate !== undefined ? customer.defaultRate : 0;
                document.getElementById('defaultMilkType').value = customer.defaultMilkType || '';
            }
        }

        function deleteCustomer(id) {
            showModal(
                'Confirm Deletion',
                'Are you sure you want to delete this customer? All associated transactions and payments will also be removed.',
                () => {
                    customers = customers.filter(c => c.id !== id);
                    transactions = transactions.filter(t => t.customerId !== id);
                    payments = payments.filter(p => p.customerId !== id);
                    saveData(); // Save data to localStorage after changes
                    customerPaginationState.currentPage = 1; // Reset to first page after deletion
                    renderAllData();
                }
            );
        }

        // Transaction Form
        const transactionForm = document.getElementById('transactionForm');
        const transactionEditIdHidden = document.getElementById('transactionEditId'); // New hidden field for edit ID
        const transactionCustomerSearchInput = document.getElementById('transactionCustomerSearch'); // New search input
        const transactionCustomerIdHidden = document.getElementById('transactionCustomerId'); // Hidden ID field
        const customerSearchResultsDiv = document.getElementById('customerSearchResults'); // Div for search results
        const selectedCustomerTypeDisplay = document.getElementById('selectedCustomerTypeDisplay');
        const transactionQuantityInput = document.getElementById('transactionQuantity');
        const transactionRateInput = document.getElementById('transactionRate');
        const milkTypeSelect = document.getElementById('milkType'); // Milk type select
        const shiftSelect = document.getElementById('shift'); // Shift select
        const transactionDateInput = document.getElementById('transactionDate'); // Date input field

        // Event listener for customer search input
        transactionCustomerSearchInput.addEventListener('input', () => {
            const searchTerm = transactionCustomerSearchInput.value.toLowerCase();
            customerSearchResultsDiv.innerHTML = ''; // Clear previous results
            transactionCustomerIdHidden.value = ''; // Clear selected ID
            selectedCustomerTypeDisplay.value = ''; // Clear displayed type
            // Clear transaction form fields when search changes
            transactionQuantityInput.value = '';
            transactionRateInput.value = '';
            milkTypeSelect.value = '';


            if (searchTerm.length > 0) {
                const filteredCustomers = customers.filter(customer =>
                    customer.name.toLowerCase().includes(searchTerm)
                );

                if (filteredCustomers.length > 0) {
                    customerSearchResultsDiv.classList.remove('hidden');
                    filteredCustomers.forEach(customer => {
                        const resultItem = document.createElement('div');
                        resultItem.className = 'px-3 py-2 cursor-pointer hover:bg-blue-100 rounded-md';
                        resultItem.textContent = `${customer.name} (${customer.type === 'seller' ? 'Seller' : 'Buyer'})`;
                        resultItem.dataset.customerId = customer.id;
                        resultItem.dataset.customerType = customer.type;

                        resultItem.addEventListener('click', () => {
                            transactionCustomerSearchInput.value = customer.name;
                            transactionCustomerIdHidden.value = customer.id;
                            selectedCustomerTypeDisplay.value = customer.type === 'seller' ? 'Seller' : 'Buyer';
                            customerSearchResultsDiv.classList.add('hidden'); // Hide results after selection

                            // Populate transaction form with default values
                            transactionQuantityInput.value = customer.defaultQuantity !== undefined ? customer.defaultQuantity : '';
                            transactionRateInput.value = customer.defaultRate !== undefined ? customer.defaultRate : '';
                            milkTypeSelect.value = customer.defaultMilkType || '';
                        });
                        customerSearchResultsDiv.appendChild(resultItem);
                    });
                } else {
                    customerSearchResultsDiv.classList.add('hidden');
                }
            } else {
                customerSearchResultsDiv.classList.add('hidden');
            }
        });

        // Hide search results when input loses focus (with a slight delay to allow click)
        transactionCustomerSearchInput.addEventListener('blur', () => {
            setTimeout(() => {
                customerSearchResultsDiv.classList.add('hidden');
            }, 150); // Small delay
        });

        transactionForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = transactionEditIdHidden.value; // Get ID for edit
            const customerId = transactionCustomerIdHidden.value; // Get ID from hidden field
            const selectedCustomer = customers.find(c => c.id === customerId);

            if (!selectedCustomer) {
                showModal('Input Error', 'Please select a valid customer from the search suggestions.', () => {}, 'OK', '', 'bg-blue-600 hover:bg-blue-700');
                return;
            }

            // Determine transaction type based on customer type
            const transactionType = selectedCustomer.type === 'seller' ? 'buy' : 'sell';

            const quantity = parseFloat(transactionQuantityInput.value);
            const rate = parseFloat(transactionRateInput.value);
            const milkType = milkTypeSelect.value;
            const shift = shiftSelect.value;
            let date = transactionDateInput.value;

            // If date is empty, set it to current date
            if (!date) {
                const today = new Date();
                date = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
            }

            // Removed !shift from the validation condition
            if (isNaN(quantity) || isNaN(rate) || !milkType) {
                showModal('Input Error', 'Quantity, Rate, and Milk Type are required and must be valid numbers/selections.', () => {}, 'OK', '', 'bg-blue-600 hover:bg-blue-700');
                return;
            }

            if (id) {
                // Update existing transaction
                const index = transactions.findIndex(t => t.id === id);
                if (index !== -1) {
                    transactions[index] = { ...transactions[index], customerId, type: transactionType, quantity, rate, milkType, shift, date };
                }
            } else {
                // Add new transaction
                transactions.push({
                    id: generateId('transaction'),
                    customerId,
                    type: transactionType,
                    quantity,
                    rate,
                    milkType,
                    shift, // Shift is now optional
                    date
                });
            }

            transactionForm.reset();
            transactionEditIdHidden.value = ''; // Clear hidden edit ID
            transactionCustomerSearchInput.value = ''; // Clear search input
            transactionCustomerIdHidden.value = ''; // Clear hidden ID
            selectedCustomerTypeDisplay.value = ''; // Clear display field
            saveData(); // Save data to localStorage after changes
            transactionPaginationState.currentPage = 1; // Reset to first page after adding/updating
            renderAllData();
        });

        function editTransaction(id) {
            const transaction = transactions.find(t => t.id === id);
            if (transaction) {
                transactionEditIdHidden.value = transaction.id;
                transactionCustomerIdHidden.value = transaction.customerId;

                const customer = customers.find(c => c.id === transaction.customerId);
                if (customer) {
                    transactionCustomerSearchInput.value = customer.name;
                    selectedCustomerTypeDisplay.value = customer.type === 'seller' ? 'Seller' : 'Buyer';
                } else {
                    transactionCustomerSearchInput.value = 'Unknown Customer';
                    selectedCustomerTypeDisplay.value = 'N/A';
                }

                shiftSelect.value = transaction.shift || '';
                transactionQuantityInput.value = transaction.quantity;
                transactionRateInput.value = transaction.rate;
                milkTypeSelect.value = transaction.milkType;
                transactionDateInput.value = transaction.date;
            }
        }

        function deleteTransaction(id) {
            showModal(
                'Confirm Deletion',
                'Are you sure you want to delete this transaction record?',
                () => {
                    transactions = transactions.filter(t => t.id !== id);
                    saveData(); // Save data to localStorage after changes
                    transactionPaginationState.currentPage = 1; // Reset to first page after deletion
                    renderAllData();
                }
            );
        }

        // Payment Form
        const paymentForm = document.getElementById('paymentForm');
        const paymentEditIdHidden = document.getElementById('paymentEditId'); // New hidden field for edit ID
        const paymentCustomerSearchInput = document.getElementById('paymentCustomerSearch'); // New search input for payments
        const paymentCustomerIdHidden = document.getElementById('paymentCustomerId'); // Hidden ID field for payments
        const paymentCustomerSearchResultsDiv = document.getElementById('paymentCustomerSearchResults'); // Div for search results for payments
        const paymentSelectedCustomerTypeDisplay = document.getElementById('paymentSelectedCustomerTypeDisplay'); // Display for selected customer type for payments
        const paymentDateInput = document.getElementById('paymentDate'); // Get the date input field

        // Event listener for payments customer search input
        paymentCustomerSearchInput.addEventListener('input', () => {
            const searchTerm = paymentCustomerSearchInput.value.toLowerCase();
            paymentCustomerSearchResultsDiv.innerHTML = ''; // Clear previous results
            paymentCustomerIdHidden.value = ''; // Clear selected ID
            paymentSelectedCustomerTypeDisplay.value = ''; // Clear displayed type

            if (searchTerm.length > 0) {
                const filteredCustomers = customers.filter(customer =>
                    customer.name.toLowerCase().includes(searchTerm)
                );

                if (filteredCustomers.length > 0) {
                    paymentCustomerSearchResultsDiv.classList.remove('hidden');
                    filteredCustomers.forEach(customer => {
                        const resultItem = document.createElement('div');
                        resultItem.className = 'px-3 py-2 cursor-pointer hover:bg-blue-100 rounded-md';
                        resultItem.textContent = `${customer.name} (${customer.type === 'seller' ? 'Seller' : 'Buyer'})`;
                        resultItem.dataset.customerId = customer.id;
                        resultItem.dataset.customerType = customer.type;

                        resultItem.addEventListener('click', () => {
                            paymentCustomerSearchInput.value = customer.name;
                            paymentCustomerIdHidden.value = customer.id;
                            paymentSelectedCustomerTypeDisplay.value = customer.type === 'seller' ? 'Seller' : 'Buyer';
                            paymentCustomerSearchResultsDiv.classList.add('hidden'); // Hide results after selection
                        });
                        paymentCustomerSearchResultsDiv.appendChild(resultItem);
                    });
                } else {
                    paymentCustomerSearchResultsDiv.classList.add('hidden');
                }
            } else {
                paymentCustomerSearchResultsDiv.classList.add('hidden');
            }
        });

        // Hide search results when input loses focus (with a slight delay to allow click)
        paymentCustomerSearchInput.addEventListener('blur', () => {
            setTimeout(() => {
                paymentCustomerSearchResultsDiv.classList.add('hidden');
            }, 150); // Small delay
        });

        paymentForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const id = paymentEditIdHidden.value; // Get ID for edit
            const customerId = paymentCustomerIdHidden.value; // Get ID from hidden field
            const selectedCustomer = customers.find(c => c.id === customerId);

            if (!selectedCustomer) {
                showModal('Input Error', 'Please select a valid customer from the search suggestions.', () => {}, 'OK', '', 'bg-blue-600 hover:bg-blue-700');
                return;
            }

            const type = document.getElementById('paymentType').value;
            const amount = parseFloat(document.getElementById('paymentAmount').value);
            let date = paymentDateInput.value; // Get the date value

            // If date is empty, set it to current date
            if (!date) {
                const today = new Date();
                date = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
            }

            if (!customerId || !type || isNaN(amount)) {
                showModal('Input Error', 'Customer, Payment Type, and Amount are required and must be valid numbers.', () => {}, 'OK', '', 'bg-blue-600 hover:bg-blue-700');
                return;
            }

            if (id) {
                // Update existing payment
                const index = payments.findIndex(p => p.id === id);
                if (index !== -1) {
                    payments[index] = { ...payments[index], customerId, type, amount, date };
                }
            } else {
                // Add new payment
                payments.push({
                    id: generateId('payment'),
                    customerId,
                    type,
                    amount,
                    date
                });
            }

            paymentForm.reset();
            paymentEditIdHidden.value = ''; // Clear hidden edit ID
            paymentCustomerSearchInput.value = ''; // Clear search input
            paymentCustomerIdHidden.value = ''; // Clear hidden ID
            paymentSelectedCustomerTypeDisplay.value = ''; // Clear display field
            saveData(); // Save data to localStorage after changes
            paymentPaginationState.currentPage = 1; // Reset to first page after adding/updating
            renderAllData();
        });

        function editPayment(id) {
            const payment = payments.find(p => p.id === id);
            if (payment) {
                paymentEditIdHidden.value = payment.id;
                paymentCustomerIdHidden.value = payment.customerId;

                const customer = customers.find(c => c.id === payment.customerId);
                if (customer) {
                    paymentCustomerSearchInput.value = customer.name;
                    paymentSelectedCustomerTypeDisplay.value = customer.type === 'seller' ? 'Seller' : 'Buyer';
                } else {
                    paymentCustomerSearchInput.value = 'Unknown Customer';
                    paymentSelectedCustomerTypeDisplay.value = 'N/A';
                }

                document.getElementById('paymentType').value = payment.type;
                document.getElementById('paymentAmount').value = payment.amount;
                document.getElementById('paymentDate').value = payment.date;
            }
        }

        function deletePayment(id) {
            showModal(
                'Confirm Deletion',
                'Are you sure you want to delete this payment record?',
                () => {
                    payments = payments.filter(p => p.id !== id);
                    saveData(); // Save data to localStorage after changes
                    paymentPaginationState.currentPage = 1; // Reset to first page after deletion
                    renderAllData();
                }
            );
        }

        // --- Tab Navigation ---
        const tabs = {
            dashboard: { button: document.getElementById('dashboardTab'), section: document.getElementById('dashboardSection') },
            customers: { button: document.getElementById('customersTab'), section: document.getElementById('customersSection') },
            transactions: { button: document.getElementById('transactionsTab'), section: document.getElementById('transactionsSection') },
            payments: { button: document.getElementById('paymentsTab'), section: document.getElementById('paymentsSection') },
            reports: { button: document.getElementById('reportsTab'), section: document.getElementById('reportsSection') }, // New tab definition
            dataManagement: { button: document.getElementById('dataManagementTab'), section: document.getElementById('dataManagementSection') },
        };

        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const mainNav = document.getElementById('mainNav');

        // Toggle mobile menu visibility
        hamburgerBtn.addEventListener('click', () => {
            mainNav.classList.toggle('mobile-menu-open');
            mainNav.classList.toggle('mobile-menu-closed');
        });


        function setActiveTab(activeTabId) {
            for (const tabId in tabs) {
                const tab = tabs[tabId];
                // Remove all specific active/inactive classes first to reset state
                tab.button.classList.remove('bg-white', 'text-blue-800', 'text-white');

                if (tabId === activeTabId) {
                    tab.button.classList.add('bg-white', 'text-blue-800'); // New active background and text color
                    tab.section.classList.remove('hidden');
                } else {
                    tab.button.classList.add('text-white'); // Ensure inactive tabs have white text (from header default)
                    tab.section.classList.add('hidden');
                }
            }
            // Close mobile menu after selecting a tab if on small screen
            if (window.innerWidth < 640) {
                mainNav.classList.remove('mobile-menu-open'); // Ensure it's closed
                mainNav.classList.add('mobile-menu-closed'); // Ensure it's hidden
            }
            renderAllData(); // Re-render data whenever tab changes
        }

        for (const tabId in tabs) {
            tabs[tabId].button.addEventListener('click', () => setActiveTab(tabId));
        }

        // --- Event Listeners for Sorting and Search ---

        // Dashboard
        document.getElementById('dashboardSearch').addEventListener('input', (e) => {
            dashboardSearchTerm = e.target.value;
            dashboardPaginationState.currentPage = 1; // Reset to first page on search change
            renderDashboard();
        });
        document.getElementById('dashboardStartDate').addEventListener('change', (e) => {
            dashboardDateRange.start = e.target.value;
            dashboardPaginationState.currentPage = 1; // Reset to first page on date filter change
            renderDashboard();
        });
        document.getElementById('dashboardEndDate').addEventListener('change', (e) => {
            dashboardDateRange.end = e.target.value;
            dashboardPaginationState.currentPage = 1; // Reset to first page on date filter change
            renderDashboard();
        });
        document.getElementById('dashboardSection').querySelectorAll('th.sortable-header').forEach(header => {
            header.addEventListener('click', (e) => handleSortClick(e, dashboardSortConfig, renderDashboard, dashboardPaginationState));
        });

        // Customers
        document.getElementById('customerSearch').addEventListener('input', (e) => {
            customerSearchTerm = e.target.value;
            customerPaginationState.currentPage = 1; // Reset to first page on search change
            renderCustomers();
        });
        document.getElementById('customerStartDate').addEventListener('change', (e) => {
            customerDateRange.start = e.target.value;
            customerPaginationState.currentPage = 1; // Reset to first page on date filter change
            renderCustomers();
        });
        document.getElementById('customerEndDate').addEventListener('change', (e) => {
            customerDateRange.end = e.target.value;
            customerPaginationState.currentPage = 1; // Reset to first page on date filter change
            renderCustomers();
        });
        document.getElementById('customersSection').querySelectorAll('th.sortable-header').forEach(header => {
            header.addEventListener('click', (e) => handleSortClick(e, customerSortConfig, renderCustomers, customerPaginationState));
        });

        // Transactions
        document.getElementById('transactionSearch').addEventListener('input', (e) => {
            transactionSearchTerm = e.target.value;
            transactionPaginationState.currentPage = 1; // Reset to first page on search change
            renderTransactions();
        });
        document.getElementById('transactionStartDate').addEventListener('change', (e) => {
            transactionDateRange.start = e.target.value;
            transactionPaginationState.currentPage = 1; // Reset to first page on date filter change
            renderTransactions();
        });
        document.getElementById('transactionEndDate').addEventListener('change', (e) => {
            transactionDateRange.end = e.target.value;
            transactionPaginationState.currentPage = 1; // Reset to first page on date filter change
            renderTransactions();
        });
        document.getElementById('transactionsSection').querySelectorAll('th.sortable-header').forEach(header => {
            header.addEventListener('click', (e) => handleSortClick(e, transactionSortConfig, renderTransactions, transactionPaginationState));
        });

        // Payments
        document.getElementById('paymentSearch').addEventListener('input', (e) => {
            paymentSearchTerm = e.target.value;
            paymentPaginationState.currentPage = 1; // Reset to first page on search change
            renderPayments();
        });
        document.getElementById('paymentStartDate').addEventListener('change', (e) => {
            paymentDateRange.start = e.target.value;
            paymentPaginationState.currentPage = 1; // Reset to first page on date filter change
            renderPayments();
        });
        document.getElementById('paymentEndDate').addEventListener('change', (e) => {
            paymentDateRange.end = e.target.value;
            paymentPaginationState.currentPage = 1; // Reset to first page on date filter change
            renderPayments();
        });
        document.getElementById('paymentsSection').querySelectorAll('th.sortable-header').forEach(header => {
            header.addEventListener('click', (e) => handleSortClick(e, paymentSortConfig, renderPayments, paymentPaginationState));
        });

        // Reports Date Range Listeners
        document.getElementById('reportStartDate').addEventListener('change', renderReports);
        document.getElementById('reportEndDate').addEventListener('change', renderReports);

        // --- Missing Transactions Feature Logic ---
        const missingTransactionDateInput = document.getElementById('missingTransactionDate');
        const checkMissingTransactionsBtn = document.getElementById('checkMissingTransactionsBtn');
        const missingTransactionsResultsDiv = document.getElementById('missingTransactionsResults');

        function findCustomersWithNoTransactionsOnDate(checkDateString) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(checkDateString)) {
                return []; // Return empty if date format is incorrect
            }

            const targetDate = checkDateString;

            const customersWithTransactionsOnDate = new Set();
            transactions.forEach(transaction => {
                if (transaction.date === targetDate) {
                    customersWithTransactionsOnDate.add(transaction.customerId);
                }
            });

            const customersWithoutTransactions = customers.filter(customer =>
                !customersWithTransactionsOnDate.has(customer.id)
            );

            return customersWithoutTransactions;
        }

        function displayMissingTransactions() {
            const dateToCheck = missingTransactionDateInput.value;
            missingTransactionsResultsDiv.innerHTML = ''; // Clear previous results

            if (!dateToCheck) {
                missingTransactionsResultsDiv.innerHTML = '<p class="text-gray-500 text-sm">Please select a date to check.</p>';
                return;
            }

            const missingCustomers = findCustomersWithNoTransactionsOnDate(dateToCheck);

            if (missingCustomers.length > 0) {
                const ul = document.createElement('ul');
                ul.className = 'list-disc list-inside space-y-1 text-gray-800';
                missingCustomers.forEach(customer => {
                    const li = document.createElement('li');
                    li.textContent = `${customer.name} (Type: ${customer.type === 'seller' ? 'Seller' : 'Buyer'}, Phone: ${customer.phone || 'N/A'})`;
                    ul.appendChild(li);
                });
                missingTransactionsResultsDiv.appendChild(ul);
            } else {
                missingTransactionsResultsDiv.innerHTML = `<p class="text-green-600 font-medium">All customers have at least one transaction on ${formatDate(dateToCheck)}.</p>`;
            }
        }

        checkMissingTransactionsBtn.addEventListener('click', displayMissingTransactions);

        // Set default date for missing transaction check to today
        function setInitialMissingTransactionDate() {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
            const day = String(today.getDate()).padStart(2, '0');
            missingTransactionDateInput.value = `${year}-${month}-${day}`;
        }

        // Set default date for reports to cover a reasonable period (e.g., last 30 days)
        function setInitialReportDateRange() {
            const today = new Date();
            const endDate = today.toISOString().split('T')[0];

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);
            const startDate = thirtyDaysAgo.toISOString().split('T')[0];

            document.getElementById('reportStartDate').value = startDate;
            document.getElementById('reportEndDate').value = endDate;
            reportDateRange.start = startDate;
            reportDateRange.end = endDate;
        }


        // --- JSON File Management Event Listeners (now attached to elements in dataManagementSection) ---
        // These elements are now within the dataManagementSection, so their IDs are unique.
        document.getElementById('exportDataBtn').addEventListener('click', exportDataToJson);
        document.getElementById('importDataBtn').addEventListener('click', () => {
            document.getElementById('importFileInput').click(); // Trigger file input click
        });
        document.getElementById('importFileInput').addEventListener('change', importDataFromJson);

        // --- Delete All Data Functionality ---
        const deleteAllDataBtn = document.getElementById('deleteAllDataBtn');
        deleteAllDataBtn.addEventListener('click', () => {
            showModal(
                'Confirm All Data Deletion',
                'Are you absolutely sure you want to delete ALL customer, transaction, and payment data? This action cannot be undone.',
                () => {
                    customers = [];
                    transactions = [];
                    payments = [];
                    idCounters = { customer: 0, transaction: 0, payment: 0 }; // Reset ID counters
                    saveData(); // Save empty state
                    // Reset all pagination states to page 1
                    dashboardPaginationState.currentPage = 1;
                    customerPaginationState.currentPage = 1;
                    transactionPaginationState.currentPage = 1;
                    paymentPaginationState.currentPage = 1;
                    renderAllData(); // Re-render UI with empty data
                    showModal('Data Deleted', 'All data has been successfully deleted.', () => {}, 'OK', '', 'bg-blue-600 hover:bg-blue-700');
                },
                'Delete All', // Custom text for confirm button
                'Cancel',
                'bg-red-600 hover:bg-red-700' // Custom class for confirm button
            );
        });


        // --- Initialization ---
        window.onload = function() {
            document.getElementById('currentYear').textContent = new Date().getFullYear();

            // Check for localStorage support
            if (typeof(Storage) === "undefined") {
                showModal('Browser Error', 'Your browser does not support local storage. Data persistence will not work.', () => {}, 'OK', '', 'bg-blue-600 hover:bg-blue-700');
            }

            loadData(); // Load initial data from localStorage
            setInitialMissingTransactionDate(); // Set default date for missing transactions
            setInitialReportDateRange(); // Set default date range for reports
            setActiveTab('dashboard'); // Set initial active tab (will trigger renderAllData)
        };