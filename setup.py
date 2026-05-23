from setuptools import find_packages, setup
import os

package_name = 'rb300_webui'

# Collect dist/ recursively for data_files
def collect_dist():
    dist_files = []
    dist_dir = 'dist'
    if os.path.exists(dist_dir):
        for root, dirs, files in os.walk(dist_dir):
            target = os.path.join('share', package_name, os.path.relpath(root, dist_dir))
            dist_files.append((target, [os.path.join(root, f) for f in files]))
    return dist_files

setup(
    name=package_name,
    version='0.0.1',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages',
            ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        ('share/' + package_name + '/launch', ['launch/webui_launch.py']),
    ] + collect_dist(),
    install_requires=['setuptools', 'flask', 'flask-socketio', 'flask-cors'],
    zip_safe=True,
    maintainer='Maintainer',
    maintainer_email='maintainer@example.com',
    description='Web UI and ROS2 bridge for RB300 robot (React + Vite)',
    license='MIT',
    tests_require=['pytest'],
    entry_points={
        'console_scripts': [
            'webui_node = rb300_webui.webui_node:main',
        ],
    },
)
