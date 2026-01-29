/**
 * ============================================
 * FORM SUGGESTER
 * Smart form field population with user control
 * ============================================
 */

const FormSuggester = {
    /**
     * Suggest value to form field with visual feedback
     * @param {string} fieldId - Form field ID
     * @param {*} value - Suggested value
     * @param {Object} validation - Validation result from MedicalValidator
     */
    suggestValue(fieldId, value, validation) {
        const field = document.getElementById(fieldId);
        if (!field) {
            console.warn(`Field ${fieldId} not found`);
            return;
        }

        // Create suggestion container
        const suggestionId = `suggestion-${fieldId}`;
        let suggestionContainer = document.getElementById(suggestionId);

        // Remove existing suggestion if any
        if (suggestionContainer) {
            suggestionContainer.remove();
        }

        // Create new suggestion UI
        suggestionContainer = document.createElement('div');
        suggestionContainer.id = suggestionId;
        suggestionContainer.className = 'value-suggestion mt-2';

        // Build suggestion HTML based on validation
        const severityClass = validation.valid ? validation.severity : 'danger';
        const icon = this.getSeverityIcon(severityClass);

        suggestionContainer.innerHTML = `
            <div class="suggestion-card bg-${severityClass}-subtle border-${severityClass}">
                <div class="suggestion-header">
                    <div class="suggestion-icon text-${severityClass}">
                        ${icon}
                    </div>
                    <div class="suggestion-content">
                        <div class="suggestion-label">Detected from report:</div>
                        <div class="suggestion-value">${value}</div>
                        <div class="suggestion-message">
                            <i class="bi bi-info-circle"></i> ${validation.message}
                        </div>
                    </div>
                </div>
                <div class="suggestion-actions">
                    <button type="button" class="btn btn-sm btn-success" onclick="FormSuggester.acceptSuggestion('${fieldId}', '${value}', '${suggestionId}')">
                        <i class="bi bi-check-circle"></i> Accept
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="FormSuggester.rejectSuggestion('${suggestionId}')">
                        <i class="bi bi-x-circle"></i> Reject
                    </button>
                </div>
            </div>
        `;

        // Insert after the form field
        field.parentElement.appendChild(suggestionContainer);

        // Highlight the field
        field.classList.add('field-with-suggestion');

        // Scroll to suggestion
        suggestionContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    },

    /**
     * Accept suggested value
     */
    acceptSuggestion(fieldId, value, suggestionId) {
        const field = document.getElementById(fieldId);
        const suggestion = document.getElementById(suggestionId);

        if (field) {
            // Fill the field
            field.value = value;
            
            // Add success class
            field.classList.remove('field-with-suggestion');
            field.classList.add('is-valid');

            // Trigger change event for any listeners
            field.dispatchEvent(new Event('change'));

            // Remove suggestion with animation
            if (suggestion) {
                suggestion.style.opacity = '0';
                suggestion.style.transform = 'translateY(-10px)';
                setTimeout(() => suggestion.remove(), 300);
            }

            // Show brief success feedback
            this.showFieldFeedback(field, 'Value accepted', 'success');
        }
    },

    /**
     * Reject suggested value
     */
    rejectSuggestion(suggestionId) {
        const suggestion = document.getElementById(suggestionId);
        if (suggestion) {
            const fieldId = suggestionId.replace('suggestion-', '');
            const field = document.getElementById(fieldId);
            
            if (field) {
                field.classList.remove('field-with-suggestion');
            }

            // Remove with animation
            suggestion.style.opacity = '0';
            suggestion.style.transform = 'translateX(20px)';
            setTimeout(() => suggestion.remove(), 300);
        }
    },

    /**
     * Show temporary feedback on field
     */
    showFieldFeedback(field, message, type) {
        const feedback = document.createElement('div');
        feedback.className = `valid-feedback d-block`;
        feedback.innerHTML = `<i class="bi bi-check-circle-fill"></i> ${message}`;
        
        field.parentElement.appendChild(feedback);
        
        setTimeout(() => {
            feedback.remove();
            field.classList.remove('is-valid');
        }, 3000);
    },

    /**
     * Get icon based on severity
     */
    getSeverityIcon(severity) {
        const icons = {
            success: '<i class="bi bi-check-circle-fill"></i>',
            warning: '<i class="bi bi-exclamation-triangle-fill"></i>',
            danger: '<i class="bi bi-exclamation-octagon-fill"></i>',
            info: '<i class="bi bi-info-circle-fill"></i>'
        };
        return icons[severity] || icons.info;
    },

    /**
     * Batch suggest multiple values
     */
    suggestMultipleValues(suggestions) {
        // Suggestions format: [{ fieldId, value, validation }, ...]
        suggestions.forEach((suggestion, index) => {
            // Stagger the suggestions for better UX
            setTimeout(() => {
                this.suggestValue(suggestion.fieldId, suggestion.value, suggestion.validation);
            }, index * 200);
        });
    },

    /**
     * Clear all suggestions
     */
    clearAllSuggestions() {
        const suggestions = document.querySelectorAll('[id^="suggestion-"]');
        suggestions.forEach(suggestion => {
            suggestion.remove();
        });

        const highlightedFields = document.querySelectorAll('.field-with-suggestion');
        highlightedFields.forEach(field => {
            field.classList.remove('field-with-suggestion');
        });
    }
};

// Export globally
window.FormSuggester = FormSuggester;