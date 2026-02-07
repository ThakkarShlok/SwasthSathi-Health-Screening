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
        this.sessionId = this.getOrCreateSessionId();
        
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
            const transformedData = this.transformToSupabaseFormat(patientData);

            if (user) {
                transformedData.user_id = user.id;
            }

            const response = await fetch(this.apiUrl, {
                method: 'POST',
                headers: {
                    'apikey': this.supabaseKey,
                    'Authorization': `Bearer ${this.getAccessToken()}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(transformedData)
            });

            if (!response.ok) {
                throw new Error(`Supabase error: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Screening saved:', data[0].id);

            return { success: true, id: data[0].id, source: 'supabase' };

        } catch (error) {
            console.error('❌ Save failed:', error);
            return { success: false, error: error.message };
        }
    }

    async getLatestScreening() {
        try {
            const user = await this.checkAuthState();
            
            let url;
            if (user) {
                url = `${this.apiUrl}?user_id=eq.${user.id}&order=created_at.desc&limit=1`;
            } else {
                url = `${this.apiUrl}?session_fingerprint=eq.${this.sessionId}&order=created_at.desc&limit=1`;
            }

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

    getOrCreateSessionId() {
        let sessionId = localStorage.getItem('swasthsathi_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('swasthsathi_session_id', sessionId);
        }
        return sessionId;
    }

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
            session_fingerprint: this.sessionId
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
                bloodPressure: dbData.blood_pressure
            },
            timestamp: dbData.created_at
        };
    }
}

// Initialize global client
window.supabaseClient = new SupabaseClient();

console.log('✅ Supabase client initialized (v3.0)');