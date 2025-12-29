
    // Character counter for textarea
    const additionalSymptoms = document.getElementById('additionalSymptoms');
    const charCount = document.getElementById('charCount');
    
    if (additionalSymptoms && charCount) {
        additionalSymptoms.addEventListener('input', function() {
            const currentLength = this.value.length;
            charCount.textContent = currentLength + ' / 500';
            
            // Change color when approaching limit
            if (currentLength > 450) {
                charCount.style.color = '#dc3545'; // Red
            } else if (currentLength > 400) {
                charCount.style.color = '#ffc107'; // Yellow
            } else {
                charCount.style.color = '#6c757d'; // Gray
            }
        });
    }

document.getElementById("screeningForm").addEventListener("submit", function(e) {
    e.preventDefault();

    const patientData = {
        name: name.value,
        age: age.value,
        gender: gender.value,
        height: height.value,
        weight: weight.value,

        diagnosed: {
            diabetes: diabetes.value,
            hypertension: hypertension.value
        },

        symptoms: {
            frequentUrination: frequentUrination.checked,
            excessiveThirst: excessiveThirst.checked,
            weightLoss: weightLoss.checked,
            fatigue: fatigue.checked,
            blurredVision: blurredVision.checked,
            headache: headache.checked,
            dizziness: dizziness.checked,
            chestPain: chestPain.checked,
            breathlessness: breathlessness.checked
        },

        lifestyle: {
            smoking: smoking.value,
            alcohol: alcohol.value,
            familyHistory: familyHistory.value
        },

        readings: {
            bloodSugar: sugar.value,
            bloodPressure: bp.value
        },

        timestamp: new Date().toISOString()
    };

    let data = JSON.parse(localStorage.getItem("swasthsathi_patients")) || [];
    data.push(patientData);
    localStorage.setItem("swasthsathi_patients", JSON.stringify(data));

    alert("Patient screening saved successfully.");
    this.reset();
});