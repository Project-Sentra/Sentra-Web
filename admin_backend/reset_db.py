from app import app, db, ParkingSpot
from sqlalchemy import text  # SQL විධාන යැවීමට අවශ්‍යයි

with app.app_context():
    try:
        # PostgreSQL වලදී Table එක සම්පූර්ණයෙන්ම හිස් කරලා ID එක 1 ට Reset කරන්න
        # 'TRUNCATE' විධානය භාවිතා කරයි.
        db.session.execute(text("TRUNCATE TABLE parking_spots RESTART IDENTITY;"))
        db.session.commit()
        print("Old spots deleted and IDs reset to 1.")
    except Exception as e:
        print(f"Truncate failed, trying delete: {e}")
        # යම් හෙයකින් TRUNCATE වැඩ නොකළොත් (Permissions නිසා), සාමාන්‍ය විදියට මකමු
        db.session.query(ParkingSpot).delete()
        db.session.commit()

    # නැවත Spots 32 සාදමු (දැන් ID පටන් ගන්නේ 1 න්)
    for i in range(1, 33):
        spot_name = f"A-{str(i).zfill(2)}"
        new_spot = ParkingSpot(spot_name=spot_name, is_occupied=False)
        db.session.add(new_spot)

    db.session.commit()
    print("32 New spots created successfully with fresh IDs!")
