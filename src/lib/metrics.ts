export function calculateFFMI(weight: number, height: number, bodyFat: number): number {
  const heightM = height / 100;
  const lbm = weight * (1 - bodyFat / 100);
  const ffmi = lbm / (heightM * heightM);
  return Math.round(ffmi * 10) / 10;
}

export function calculateAdjustedFFMI(weight: number, height: number, bodyFat: number): number {
  const ffmi = calculateFFMI(weight, height, bodyFat);
  const adjusted = ffmi + (6.1 * (1.8 - (height / 100)));
  return Math.round(adjusted * 10) / 10;
}

export function calculateWHtR(waist: number, height: number): number {
  if (!waist || !height) return 0;
  return Math.round((waist / height) * 100) / 100;
}

export function calculateBmi(weight: number, height: number): number {
  const heightM = height / 100;
  return Math.round(weight / (heightM * heightM) * 10) / 10;
}

export function calculateEstimatedMaintenance(bmr: number, activityMultiplier: number): number {
  const tdeeMap: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  return Math.round(bmr * (tdeeMap[activityMultiplier] || 1.55));
}

export function getFFMIClassification(ffmi: number, sex: "male" | "female"): string {
  if (sex === "male") {
    if (ffmi < 18) return "Bajo";
    if (ffmi < 20) return "Normal";
    if (ffmi < 22) return "Bueno";
    if (ffmi < 25) return "Excelente (posible uso de sustancias)";
    return "Excepcional (muy probable uso de sustancias)";
  }
  if (ffmi < 15) return "Bajo";
  if (ffmi < 17) return "Normal";
  if (ffmi < 19) return "Bueno";
  if (ffmi < 22) return "Excelente (posible uso de sustancias)";
  return "Excepcional (muy probable uso de sustancias)";
}

export function calculateLeanBodyMass(weight: number, bodyFat: number): number {
  return Math.round(weight * (1 - bodyFat / 100) * 10) / 10;
}

export function calculateFatMass(weight: number, bodyFat: number): number {
  return Math.round(weight * (bodyFat / 100) * 10) / 10;
}
