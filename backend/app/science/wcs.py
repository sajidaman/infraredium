from astropy.io.fits import Header
from astropy.wcs import WCS


def pixel_to_sky(header: Header, x: float, y: float) -> tuple[float, float]:
    """Convert zero-based FITS pixel coordinates to WCS longitude/latitude degrees."""
    world_x, world_y = WCS(header).all_pix2world(x, y, 0)
    return float(world_x), float(world_y)


def sky_to_pixel(header: Header, longitude_deg: float, latitude_deg: float) -> tuple[float, float]:
    """Convert WCS longitude/latitude degrees to zero-based FITS pixel coordinates."""
    pixel_x, pixel_y = WCS(header).all_world2pix(longitude_deg, latitude_deg, 0)
    return float(pixel_x), float(pixel_y)
