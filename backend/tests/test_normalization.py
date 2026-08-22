import pytest

from app.services.normalization_service import (
    normalize_length,
    normalize_pressure,
    normalize_temperature,
    normalize_mass,
    normalize_material,
    normalize_thread,
    normalize_boolean,
    normalize_enum,
    normalize_value,
)


def test_length_normalization():
    # 1/2" == 12.7mm
    val, unit, _ = normalize_length('1/2"')
    assert val == "12.7"
    assert unit == "mm"

    # 1/2 in == 12.7mm
    val, unit, _ = normalize_length("1/2 in")
    assert val == "12.7"
    assert unit == "mm"

    # 1-1/2" == 38.1mm
    val, unit, _ = normalize_length('1-1/2"')
    assert val == "38.1"
    assert unit == "mm"

    # 1 1/2 in == 38.1mm
    val, unit, _ = normalize_length("1 1/2 in")
    assert val == "38.1"
    assert unit == "mm"

    # 12.7mm == 12.7mm
    val, unit, _ = normalize_length("12.7mm")
    assert val == "12.7"
    assert unit == "mm"

    # 12,7 mm == 12.7mm (comma decimal)
    val, unit, _ = normalize_length("12,7 mm")
    assert val == "12.7"
    assert unit == "mm"

    # 0.5 inch == 12.7mm
    val, unit, _ = normalize_length("0.5 inch")
    assert val == "12.7"
    assert unit == "mm"

    # .5" == 12.7mm
    val, unit, _ = normalize_length('.5"')
    assert val == "12.7"
    assert unit == "mm"

    # 25 cm == 250mm
    val, unit, _ = normalize_length("25 cm")
    assert val == "250"
    assert unit == "mm"

    # 2 ft == 609.6mm
    val, unit, _ = normalize_length("2 ft")
    assert val == "609.6"
    assert unit == "mm"


def test_pressure_normalization():
    # 600 WOG == 600 psi
    val, unit, _ = normalize_pressure("600 WOG")
    assert val == "600"
    assert unit == "psi"

    # 600WOG == 600 psi
    val, unit, _ = normalize_pressure("600WOG")
    assert val == "600"
    assert unit == "psi"

    # 150 PSI == 150 psi
    val, unit, _ = normalize_pressure("150 PSI")
    assert val == "150"
    assert unit == "psi"

    # 150# == 150 psi
    val, unit, _ = normalize_pressure("150#")
    assert val == "150"
    assert unit == "psi"

    # 10 bar == 145.0377 psi
    val, unit, _ = normalize_pressure("10 bar")
    assert val == "145.0377"
    assert unit == "psi"

    # 1000 kPa == 145.0377 psi
    val, unit, _ = normalize_pressure("1000 kPa")
    assert val == "145.0377"
    assert unit == "psi"

    # 2.5 MPa == 362.5943 psi
    val, unit, _ = normalize_pressure("2.5 MPa")
    assert val == "362.5943"
    assert unit == "psi"


def test_temperature_normalization():
    # -20F == -28.8889C
    val, unit, _ = normalize_temperature("-20F")
    assert val == "-28.8889"
    assert unit == "C"

    # -20 °F == -28.8889C
    val, unit, _ = normalize_temperature("-20 °F")
    assert val == "-28.8889"
    assert unit == "C"

    # 400 degF == 204.4444C
    val, unit, _ = normalize_temperature("400 degF")
    assert val == "204.4444"
    assert unit == "C"

    # 200C == 200C
    val, unit, _ = normalize_temperature("200C")
    assert val == "200"
    assert unit == "C"

    # -28.9 °C == -28.9C
    val, unit, _ = normalize_temperature("-28.9 °C")
    assert val == "-28.9"
    assert unit == "C"

    # -20F to 400F == "-28.8889 to 204.4444 C"
    val, unit, _ = normalize_temperature("-20F to 400F")
    assert val == "-28.8889 to 204.4444"
    assert unit == "C"


def test_mass_normalization():
    # 0.63 lbs == 0.2858 kg
    val, unit, _ = normalize_mass("0.63 lbs")
    assert val == "0.2858"
    assert unit == "kg"

    # 5 kg == 5 kg
    val, unit, _ = normalize_mass("5 kg")
    assert val == "5"
    assert unit == "kg"

    # 500 g == 0.5 kg
    val, unit, _ = normalize_mass("500 g")
    assert val == "0.5"
    assert unit == "kg"

    # 16 oz == 0.4536 kg
    val, unit, _ = normalize_mass("16 oz")
    assert val == "0.4536"
    assert unit == "kg"


def test_material_normalization():
    # SS304 == stainless_304
    val, _, _ = normalize_material("SS304")
    assert val == "stainless_304"

    # 304 SS == stainless_304
    val, _, _ = normalize_material("304 SS")
    assert val == "stainless_304"

    # Stainless Steel 304 == stainless_304
    val, _, _ = normalize_material("Stainless Steel 304")
    assert val == "stainless_304"

    # T304 == stainless_304
    val, _, _ = normalize_material("T304")
    assert val == "stainless_304"

    # Cast Bronze ASTM B584 C84400 == bronze
    val, _, _ = normalize_material("Cast Bronze ASTM B584 C84400")
    assert val == "bronze"

    # Brass ASTM B16 == brass
    val, _, _ = normalize_material("Brass ASTM B16")
    assert val == "brass"

    # Carbon Steel == carbon_steel
    val, _, _ = normalize_material("Carbon Steel WCB")
    assert val == "carbon_steel"

    # RPTFE Reinforced PTFE == ptfe
    val, _, _ = normalize_material("RPTFE Reinforced PTFE")
    assert val == "ptfe"


def test_thread_and_connections():
    val, _, _ = normalize_thread("FNPT Female NPT Threaded")
    assert val == "npt_female"

    val, _, _ = normalize_thread("MNPT")
    assert val == "npt_male"

    val, _, _ = normalize_thread("150# Flanged")
    assert val == "flanged"

    val, _, _ = normalize_thread("Socket Weld")
    assert val == "socket_weld"


def test_boolean_and_enums():
    assert normalize_boolean("Yes")[0] == "true"
    assert normalize_boolean("✓")[0] == "true"
    assert normalize_boolean("1")[0] == "true"
    assert normalize_boolean("No")[0] == "false"
    assert normalize_boolean("-")[0] == "false"
    assert normalize_boolean("0")[0] == "false"

    allowed = ["full_port", "standard_port", "reduced_port"]
    assert normalize_enum("Standard Port", allowed)[0] == "standard_port"
    assert normalize_enum("Full-Port", allowed)[0] == "full_port"


def test_canonical_alignment():
    # A product with "1/2 in" and another with "12.7mm" show identical value_norm
    res1 = normalize_value("1/2 in", unit_family="length", data_type="number")
    res2 = normalize_value("12.7mm", unit_family="length", data_type="number")
    assert res1["value_norm"] == res2["value_norm"] == "12.7"
    assert res1["unit"] == res2["unit"] == "mm"
