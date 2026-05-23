#!/usr/bin/env python3
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
import time

class CmdVelPublisher(Node):
    def __init__(self):
        super().__init__('cmd_vel_publisher')
        self.publisher = self.create_publisher(Twist, '/cmd_vel', 10)
        self.timer = self.create_publisher(Twist, '/cmd_vel', 10)

    def publish_cmd(self, linear_x, angular_z, duration, rate=10):
        msg = Twist()
        msg.linear.x = linear_x
        msg.angular.z = angular_z

        period = 1.0 / rate
        end_time = time.time() + duration

        while time.time() < end_time:
            self.publisher.publish(msg)
            time.sleep(period)

def main():
    rclpy.init()
    node = CmdVelPublisher()

    print("Publishing cmd_vel at 10Hz for 10 seconds...")
    print("Linear: 0.1 m/s, Angular: 0.0 rad/s")

    # 直進 0.1 m/s で 10秒間
    node.publish_cmd(linear_x=0.1, angular_z=0.0, duration=10.0, rate=10)

    print("Finished!")
    rclpy.shutdown()

if __name__ == '__main__':
    main()
