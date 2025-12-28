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