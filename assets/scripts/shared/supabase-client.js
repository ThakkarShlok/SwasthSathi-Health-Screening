/**
 * ============================================
 * SUPABASE CLIENT - PRODUCTION READY VERSION
 * Handles authentication + database operations
 * Version: 3.0 - Complete Fix
 * ============================================
 */

class SupabaseClient {
    constructor() {
        this.supabaseUrl = 'https://ersclejdrqnaxlhrfbhg.supabase.co';
        this.supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVyc2NsZWpkcnFuYXhsaHJmYmhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzMDYyODMsImV4cCI6MjA4NDg4MjI4M30.W0Jx_LO7B16DGEDqmL39O5fBkYFoGJlE3Do3Y7BHiLg';
        
        this.apiUrl = `${this.supabaseUrl}/rest/v1/health_screenings`;
        this.authUrl = `${this.supabaseUrl}/auth/v1`;

        console.log('🔧 Supabase client initializing...');
    }

    // ==========================================
    // AUTHENTICATION METHODS
    // ==========================================

    /**
     * Check if user is currently logged in
     */
    async checkAuthState() {
        const token = this.getAccessToken();
        
        if (!token) {
            console.log('ℹ️ No active session');
            return null;
        }

        try {
            const response = await fetch(`${this.authUrl}/user`, {
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const user = await response.json();
                console.log('✅ User logged in:', user.email);
                return user;
            }
            
            // Token expired/invalid
            if (response.status === 401) {
                console.log('ℹ️ Session expired - clearing tokens');
                this.clearTokens();
            }
            
            return null;
        } catch (error) {
            console.log('ℹ️ Auth check failed');
            return null;
        }
    }

    /**
     * Sign up new user - FIXED VERSION
     */
    async signUp(email, password, fullName, city, state) {
        try {
            console.log('🔐 Creating account for:', email);

            // Step 1: Create auth user (with autoconfirm bypass)
            const authResponse = await fetch(`${this.authUrl}/signup`, {
                method: 'POST',
                headers: {
                    'apikey': this.supabaseKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email.toLowerCase(),
                    password,
                    options: {
                        data: {
                            full_name: fullName
                        }
                    }
                })
            });

            const authData = await authResponse.json();

            // Handle specific errors
            if (!authResponse.ok) {
                if (authResponse.status === 429) {
                    return { success: false, error: 'Rate limit exceeded. Please wait 5 minutes.' };
                }
                
                if (authData.msg) {
                    if (authData.msg.includes('already registered')) {
                        return { success: false, error: 'Email already registered. Try logging in.' };
                    }
                    return { success: false, error: authData.msg };
                }
                
                return { success: false, error: 'Signup failed. Please try again.' };
            }

            if (!authData.user) {
                return { success: false, error: 'Account created but user data missing.' };
            }

            // Store tokens immediately
            if (authData.access_token) {
                this.storeTokens(authData);
                console.log('✅ Tokens stored');
            }

            // Step 2: Create user profile
            try {
                const profileResponse = await fetch(`${this.supabaseUrl}/rest/v1/users_profile`, {
                    method: 'POST',
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${authData.access_token}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify({
                        user_id: authData.user.id,
                        full_name: fullName,
                        city: city || null,
                        state: state || null
                    })
                });

                if (!profileResponse.ok) {
                    console.warn('⚠️ Profile creation failed, but auth succeeded');
                }

                console.log('✅ Signup complete');
                return { success: true, user: authData.user };

            } catch (profileError) {
                console.warn('⚠️ Profile creation error:', profileError);
                // Auth succeeded, profile failed - still return success
                return { success: true, user: authData.user };
            }

        } catch (error) {
            console.error('❌ Signup error:', error);
            return { success: false, error: 'Network error. Please check connection.' };
        }
    }

    /**
     * Log in existing user - FIXED VERSION
     */
    async login(email, password) {
        try {
            console.log('🔐 Logging in:', email);

            const response = await fetch(`${this.authUrl}/token?grant_type=password`, {
                method: 'POST',
                headers: {
                    'apikey': this.supabaseKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email.toLowerCase(),
                    password
                })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error('❌ Login failed:', data);
                
                if (data.error === 'invalid_grant') {
                    return { success: false, error: 'Invalid email or password' };
                }
                
                if (data.error_description) {
                    if (data.error_description.includes('Email not confirmed')) {
                        return { success: false, error: 'Email not confirmed. Check your inbox.' };
                    }
                    return { success: false, error: data.error_description };
                }
                
                return { success: false, error: 'Login failed. Please try again.' };
            }

            if (!data.access_token) {
                return { success: false, error: 'No access token received' };
            }

            // Store tokens
            this.storeTokens(data);
            console.log('✅ Login successful');

            return { success: true, user: data.user };

        } catch (error) {
            console.error('❌ Login exception:', error);
            return { success: false, error: 'Network error. Please check connection.' };
        }
    }

    /**
     * Log out current user
     */
    async logout() {
        try {
            const token = this.getAccessToken();
            
            if (token) {
                await fetch(`${this.authUrl}/logout`, {
                    method: 'POST',
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${token}`
                    }
                });
            }

            this.clearTokens();
            console.log('✅ Logged out');
            return { success: true };

        } catch (error) {
            this.clearTokens();
            return { success: true };
        }
    }

    /**
     * Get current user profile
     */
    async getUserProfile() {
        try {
            const user = await this.checkAuthState();
            if (!user) return null;

            const response = await fetch(
                `${this.supabaseUrl}/rest/v1/users_profile?user_id=eq.${user.id}`,
                {
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${this.getAccessToken()}`
                    }
                }
            );

            if (!response.ok) return null;

            const profiles = await response.json();
            return profiles[0] || null;

        } catch (error) {
            console.error('❌ Profile fetch error:', error);
            return null;
        }
    }

    /**
     * Get user's screening history
     */
    async getUserScreenings() {
        try {
            const user = await this.checkAuthState();
            if (!user) return { success: false, screenings: [] };

            const response = await fetch(
                `${this.apiUrl}?user_id=eq.${user.id}&order=created_at.desc`,
                {
                    headers: {
                        'apikey': this.supabaseKey,
                        'Authorization': `Bearer ${this.getAccessToken()}`
                    }
                }
            );

            if (!response.ok) return { success: false, screenings: [] };

            const screenings = await response.json();
            console.log(`✅ Found ${screenings.length} screening(s)`);

            return { 
                success: true, 
                screenings: screenings.map(s => this.transformFromSupabaseFormat(s))
            };

        } catch (error) {
            console.error('❌ Screenings fetch error:', error);
            return { success: false, screenings: [] };
        }
    }

    // ==========================================
    // TOKEN MANAGEMENT
    // ==========================================

    storeTokens(authData) {
        try {
            localStorage.setItem('supabase_access_token', authData.access_token);
            localStorage.setItem('supabase_refresh_token', authData.refresh_token);
            localStorage.setItem('supabase_user', JSON.stringify(authData.user));
            console.log('💾 Tokens stored successfully');
        } catch (e) {
            console.error('❌ Token storage failed:', e);
        }
    }

    getAccessToken() {
        return localStorage.getItem('supabase_access_token') || '';
    }

    clearTokens() {
        localStorage.removeItem('supabase_access_token');
        localStorage.removeItem('supabase_refresh_token');
        localStorage.removeItem('supabase_user');
        console.log('🗑️ Tokens cleared');
    }

    isAuthenticated() {
        return !!this.getAccessToken();
    }

    // ==========================================
    // SCREENING SAVE/RETRIEVE
    // ==========================================

    async saveScreening(patientData) {
        try {
            const user = await this.checkAuthState();

            if (!user) {
                return { success: false, error: 'Authentication required to save screening.' };
            }

            const transformedData = this.transformToSupabaseFormat(patientData);
            transformedData.user_id = user.id;

            // Attempt 1: full payload (risk snapshot columns included if they exist in DB)
            const response = await this._postToHealthScreenings(transformedData);

            if (response.ok) {
                const saved = await response.json();
                console.log('✅ Screening saved:', saved[0]?.id);
                return { success: true, id: saved[0]?.id, source: 'supabase' };
            }

            // Read the actual error body — always log it so the exact column or constraint
            // failure is visible in DevTools instead of just a status code.
            const errorBody = await response.json().catch(() => ({}));
            console.error('❌ Supabase error body:', JSON.stringify(errorBody));

            // PGRST204 = PostgREST "column does not exist" — risk snapshot columns are not
            // yet in the live DB (CREATE TABLE IF NOT EXISTS is a no-op on existing tables;
            // ALTER TABLE ADD COLUMN was never run). Strip those columns and retry.
            if (response.status === 400 && errorBody.code === 'PGRST204') {
                console.warn('⚠️ Risk snapshot columns missing from live DB — saving core fields only');
                const coreData = this._omitRiskSnapshot(transformedData);
                const retry = await this._postToHealthScreenings(coreData);

                if (retry.ok) {
                    const saved = await retry.json();
                    console.log('✅ Screening saved (core fields):', saved[0]?.id);
                    return { success: true, id: saved[0]?.id, source: 'supabase' };
                }

                const retryError = await retry.json().catch(() => ({}));
                console.error('❌ Retry also failed:', JSON.stringify(retryError));
                throw new Error(
                    `Supabase ${retry.status}: ${retryError.message || JSON.stringify(retryError)}`
                );
            }

            throw new Error(
                `Supabase ${response.status}: ${errorBody.message || JSON.stringify(errorBody)}`
            );

        } catch (error) {
            console.error('❌ Save failed:', error);
            return { success: false, error: error.message };
        }
    }

    _postToHealthScreenings(data) {
        return fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'apikey': this.supabaseKey,
                'Authorization': `Bearer ${this.getAccessToken()}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(data)
        });
    }

    _omitRiskSnapshot(data) {
        const {
            computed_risk_score, diabetes_risk_score, hypertension_risk_score,
            risk_category, algorithm_version, language_at_screening,
            assessment_tier, data_completeness_percentage, factor_contributions,
            hba1c,
            ...core
        } = data;
        return core;
    }

    async getLatestScreening() {
        try {
            const user = await this.checkAuthState();

            if (!user) {
                return { success: false, data: null, error: 'Authentication required.' };
            }

            const url = `${this.apiUrl}?user_id=eq.${user.id}&order=created_at.desc&limit=1`;

            const response = await fetch(url, {
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.getAccessToken()}`
                }
            });

            if (!response.ok) throw new Error(`Fetch error: ${response.status}`);

            const data = await response.json();

            if (data && data.length > 0) {
                return {
                    success: true,
                    data: this.transformFromSupabaseFormat(data[0]),
                    source: 'supabase'
                };
            }

            return { success: false, data: null };

        } catch (error) {
            console.error('❌ Fetch failed:', error);
            return { success: false, error: error.message };
        }
    }

    // ==========================================
    // DATA TRANSFORMATION
    // ==========================================

    transformToSupabaseFormat(patientData) {
        return {
            patient_name: patientData.name,
            age: patientData.age,
            gender: patientData.gender,
            height: patientData.height,
            weight: patientData.weight,
            bmi: patientData.bmi,
            waist_circumference: patientData.waistCircumference,
            diagnosed_diabetes: patientData.diagnosed.diabetes === 'Yes',
            diagnosed_hypertension: patientData.diagnosed.hypertension === 'Yes',
            diabetes_symptoms: patientData.symptoms.diabetes,
            hypertension_symptoms: patientData.symptoms.hypertension,
            additional_symptoms: patientData.additionalSymptoms || null,
            physical_activity: patientData.lifestyle.physicalActivity,
            diet_pattern: patientData.lifestyle.dietPattern,
            smoking: patientData.lifestyle.smoking === 'Yes',
            alcohol_frequency: patientData.lifestyle.alcohol,
            family_history: patientData.lifestyle.familyHistory === 'Yes',
            blood_sugar: patientData.readings.bloodSugar,
            blood_pressure: patientData.readings.bloodPressure,
            // Risk snapshot fields (computed in screening.js before save)
            computed_risk_score: patientData.computedRiskScore ?? null,
            diabetes_risk_score: patientData.diabetesRiskScore ?? null,
            hypertension_risk_score: patientData.hypertensionRiskScore ?? null,
            risk_category: patientData.riskCategory ?? null,
            algorithm_version: patientData.algorithmVersion ?? null,
            language_at_screening: patientData.languageAtScreening ?? null,
            result_short_code: patientData.resultShortCode ?? null,
            hba1c: patientData.readings?.hba1c ?? null,
            assessment_tier: patientData.assessmentTier ?? null,
            data_completeness_percentage: patientData.dataCompletenessPercentage ?? null,
            factor_contributions: patientData.factorContributions ?? null
        };
    }

    transformFromSupabaseFormat(dbData) {
        return {
            id: dbData.id,
            name: dbData.patient_name,
            age: dbData.age,
            gender: dbData.gender,
            height: dbData.height,
            weight: dbData.weight,
            bmi: dbData.bmi,
            waistCircumference: dbData.waist_circumference,
            diagnosed: {
                diabetes: dbData.diagnosed_diabetes ? 'Yes' : 'No',
                hypertension: dbData.diagnosed_hypertension ? 'Yes' : 'No'
            },
            symptoms: {
                diabetes: dbData.diabetes_symptoms || {},
                hypertension: dbData.hypertension_symptoms || {}
            },
            additionalSymptoms: dbData.additional_symptoms,
            lifestyle: {
                physicalActivity: dbData.physical_activity,
                dietPattern: dbData.diet_pattern,
                smoking: dbData.smoking ? 'Yes' : 'No',
                alcohol: dbData.alcohol_frequency,
                familyHistory: dbData.family_history ? 'Yes' : 'No'
            },
            readings: {
                bloodSugar: dbData.blood_sugar,
                bloodPressure: dbData.blood_pressure,
                hba1c: dbData.hba1c
            },
            // Risk snapshot fields
            computedRiskScore: dbData.computed_risk_score ?? null,
            diabetesRiskScore: dbData.diabetes_risk_score ?? null,
            hypertensionRiskScore: dbData.hypertension_risk_score ?? null,
            riskCategory: dbData.risk_category ?? null,
            algorithmVersion: dbData.algorithm_version ?? null,
            languageAtScreening: dbData.language_at_screening ?? null,
            resultShortCode: dbData.result_short_code ?? null,
            assessmentTier: dbData.assessment_tier ?? null,
            dataCompletenessPercentage: dbData.data_completeness_percentage ?? null,
            factorContributions: dbData.factor_contributions ?? null,
            timestamp: dbData.created_at
        };
    }

    // ==========================================
    // SHAREABLE RESULT METHODS (PHASE 2A)
    // ==========================================

    async saveShortCode(screeningId, shortCode) {
        const token = this.getAccessToken();
        if (!token) return { success: false, error: 'Not authenticated' };
        try {
            const resp = await fetch(`${this.apiUrl}?id=eq.${screeningId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal',
                },
                body: JSON.stringify({ result_short_code: shortCode }),
            });
            return resp.ok ? { success: true } : { success: false, error: `HTTP ${resp.status}` };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    async getByShortCode(code) {
        try {
            const viewUrl = `${this.supabaseUrl}/rest/v1/shared_screening_results`;
            const resp = await fetch(
                `${viewUrl}?result_short_code=eq.${encodeURIComponent(code)}&select=*&limit=1`,
                { headers: { 'apikey': this.supabaseKey } },
            );
            if (!resp.ok) return null;
            const rows = await resp.json();
            return rows.length > 0 ? this.transformFromSupabaseFormat(rows[0]) : null;
        } catch {
            return null;
        }
    }
}

// Initialize global client
window.supabaseClient = new SupabaseClient();

console.log('✅ Supabase client initialized (v3.1 — resilient save)');

