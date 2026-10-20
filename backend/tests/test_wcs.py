import pytest
from astropy.io.fits import Header

from app.science.wcs import pixel_to_sky, sky_to_pixel


def test_wcs_round_trip_uses_zero_based_pixels() -> None:
    header = Header()
    header["NAXIS"] = 2
    header["NAXIS1"] = 100
    header["NAXIS2"] = 100
    header["CTYPE1"] = "RA---TAN"
    header["CTYPE2"] = "DEC--TAN"
    header["CRPIX1"] = 50
    header["CRPIX2"] = 50
    header["CRVAL1"] = 180
    header["CRVAL2"] = 0
    header["CDELT1"] = -0.001
    header["CDELT2"] = 0.001

    sky = pixel_to_sky(header, 49, 49)
    pixel = sky_to_pixel(header, *sky)

    assert pixel[0] == pytest.approx(49, abs=1e-6)
    assert pixel[1] == pytest.approx(49, abs=1e-6)
